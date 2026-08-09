"use client";

import { useState } from "react";

import { fileNameFor } from "@/lib/export";
import type { Details, FormatId } from "@/lib/render/types";
import {
  SHARE_TEXT,
  blobToFile,
  canShareFiles,
  copyImageToClipboard,
  intentUrl,
  shareFile,
  uploadForShare,
} from "@/lib/share";

export default function ShareBar({
  format,
  details,
  blob,
  getBlob,
  getShareBlobs,
  onDownload,
  onError,
}: {
  format: FormatId;
  details: Details;
  /** Pre-exported bytes, so the native path never awaits before share(). */
  blob: Blob | null;
  getBlob: () => Promise<Blob | null>;
  getShareBlobs: () => Promise<{ image: Blob; og: Blob } | null>;
  onDownload: () => void;
  onError: (message: string) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const filename = fileNameFor(format, details.name);

  // Computed once during render, not in an effect: this component only ever
  // mounts client-side (after a photo exists), so there's no hydration to
  // mismatch and no need for a cascading state update.
  const [canShareNatively] = useState(() =>
    canShareFiles(
      new File([new Blob([], { type: "image/png" })], "probe.png", {
        type: "image/png",
      }),
    ),
  );

  /**
   * Primary action: open X directly with the caption pre-filled.
   *
   * navigator.share() was the primary path and that was wrong — it opens the
   * OS share sheet, so the user has to hunt for X. The intent URL opens X
   * itself on desktop and deep-links straight into the app on mobile, which is
   * what "Share to X" should obviously do. The image rides along as the link's
   * OG card.
   */
  const handleShare = async () => {
    // Opened synchronously: a window.open after an await is blocked. And no
    // `noopener` here — it makes window.open return null, so the handle we
    // need to redirect would never exist.
    const popup = window.open("about:blank", "_blank");
    setSharing(true);

    try {
      const shots = await getShareBlobs();
      if (!shots) throw new Error("Couldn't prepare the image.");

      const { pageUrl } = await uploadForShare(shots.image, shots.og, {
        name: details.name,
        title: details.title,
      });
      const url = intentUrl(pageUrl);

      if (popup && !popup.closed) popup.location.href = url;
      else window.location.href = url;
    } catch {
      // Still get them to X with the caption ready; they can attach the
      // downloaded image themselves rather than hitting a dead end.
      const fallback = intentUrl("");
      if (popup && !popup.closed) popup.location.href = fallback;
      else window.location.href = fallback;
      onError("Couldn't upload the image — download it and attach it to the post.");
    } finally {
      setSharing(false);
    }
  };

  /** Secondary: hand the actual PNG to the OS sheet (mobile). */
  const handleNativeShare = () => {
    if (!blob) return;
    void shareFile(blobToFile(blob, filename), SHARE_TEXT);
  };

  const handleCopy = async () => {
    const b = await getBlob();
    if (!b) {
      onError("Couldn't export the image.");
      return;
    }
    if (await copyImageToClipboard(b)) {
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
        disabled={sharing}
      >
        {sharing ? "Opening X…" : "Share to X"}
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          onClick={onDownload}
        >
          Download
        </button>
        <button type="button" className="btn btn-quiet flex-1" onClick={handleCopy}>
          {copied ? "Copied" : "Copy image"}
        </button>
      </div>

      {canShareNatively && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="t-caption mx-auto underline underline-offset-4"
          style={{ color: "var(--ink-muted-48)" }}
        >
          Share the image file instead
        </button>
      )}
    </div>
  );
}
