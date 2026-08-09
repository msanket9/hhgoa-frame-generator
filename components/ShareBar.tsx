"use client";

import { useState } from "react";

import { fileNameFor } from "@/lib/export";
import type { Details, FormatId } from "@/lib/render/types";
import {
  blobToFile,
  canShareFiles,
  copyImageToClipboard,
  intentUrl,
  shareFile,
  uploadForShare,
} from "@/lib/share";

export default function ShareBar({
  disabled,
  format,
  details,
  blob,
  getBlob,
  getOgBlob,
  onDownload,
  onError,
}: {
  disabled: boolean;
  format: FormatId;
  details: Details;
  /** Pre-exported bytes, so the share path never awaits before share(). */
  blob: Blob | null;
  getBlob: () => Promise<Blob | null>;
  getOgBlob: () => Promise<Blob | null>;
  onDownload: () => void;
  onError: (message: string) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const filename = fileNameFor(format, details.name);

  /**
   * Deliberately not `async`.
   *
   * Safari only allows navigator.share() while user activation is live, and
   * activation is lost across an await. So the native path runs synchronously
   * off the pre-exported blob, and only the desktop fallback — which doesn't
   * need activation for anything but window.open — goes async.
   */
  const handleShare = () => {
    if (blob && canShareFiles(blobToFile(blob, filename))) {
      void shareFile(blobToFile(blob, filename)).then((result) => {
        if (result === "unsupported") void shareViaLink();
      });
      return;
    }
    void shareViaLink();
  };

  const shareViaLink = async () => {
    // Opened synchronously where possible; popup blockers reject a
    // window.open that happens after an await.
    const popup = window.open("", "_blank", "noopener,noreferrer");
    setSharing(true);

    try {
      const [image, og] = await Promise.all([getBlob(), getOgBlob()]);
      if (!image || !og) throw new Error("Couldn't prepare the image.");

      const { pageUrl } = await uploadForShare(image, og, {
        name: details.name,
        title: details.title,
      });
      const url = intentUrl(pageUrl);

      if (popup && !popup.closed) popup.location.href = url;
      else window.location.href = url;
    } catch (err) {
      popup?.close();
      onError(
        err instanceof Error
          ? `${err.message} You can still download the image and attach it.`
          : "Sharing failed. Download the image and attach it instead.",
      );
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    const b = await getBlob();
    if (!b) {
      onError("Couldn't export the image.");
      return;
    }
    const ok = await copyImageToClipboard(b);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      onError("Your browser blocked the copy. Download it instead.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={handleShare}
        disabled={disabled || sharing}
      >
        {sharing ? "Preparing…" : "Share to X"}
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          onClick={onDownload}
          disabled={disabled}
        >
          Download
        </button>
        <button
          type="button"
          className="btn btn-quiet flex-1"
          onClick={handleCopy}
          disabled={disabled}
        >
          {copied ? "Copied" : "Copy image"}
        </button>
      </div>

      <p className="t-fine text-center">
        No login. No signup. Your photo never leaves your device unless you
        share.
      </p>
    </div>
  );
}
