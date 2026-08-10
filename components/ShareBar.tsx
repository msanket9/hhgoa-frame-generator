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
  shareId,
  blob,
  getBlob,
  getShareBlobs,
  onDownload,
  onError,
}: {
  format: FormatId;
  details: Details;
  /** Pre-allocated id — must match the URL already encoded in the card's QR. */
  shareId: string;
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

  /**
   * Native share is tried first, not as a fallback.
   *
   * X's own web intent has to unfurl our /s/id page to build its link card,
   * and that step is exactly what was failing inside X's in-app browser
   * ("failed to load content") — a link-preview fetch with real failure modes
   * (cold start, redirect, timeout) sitting between the tap and the post.
   * navigator.share() skips all of that: iOS and Android hand the photo file
   * straight to X's composer, already attached, nothing to fetch.
   *
   * MUST be the very first thing this function does, with no `await` before
   * it — Safari drops user-activation across an await, so share() has to run
   * in the same tick as the click. That's also why it depends on `blob`
   * already being exported ahead of time rather than encoding on demand.
   */
  const handleShare = async () => {
    if (blob) {
      const file = blobToFile(blob, filename);
      if (canShareFiles(file)) {
        const result = await shareFile(file, SHARE_TEXT);
        // "cancelled" = the user closed the sheet on purpose; leave them there
        // rather than bouncing them into a second, different share flow.
        if (result === "shared" || result === "cancelled") return;
        // "unsupported" (Web Share rejected the file for some reason, e.g. an
        // over-large payload on some Android builds) falls through to the
        // link path below.
      }
    }

    await shareViaLink();
  };

  /** Desktop, and the rare mobile fallback above: a link with a real OG card. */
  const shareViaLink = async () => {
    // Opened synchronously where possible; popup blockers reject a
    // window.open that happens after an await. No `noopener` — that makes
    // window.open return null, and the handle is what we redirect below.
    const popup = window.open("about:blank", "_blank");
    setSharing(true);

    try {
      const shots = await getShareBlobs();
      if (!shots) throw new Error("Couldn't prepare the image.");

      const { pageUrl } = await uploadForShare(shots.image, shots.og, {
        id: shareId,
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
        <button type="button" className="btn btn-ghost flex-1" onClick={onDownload}>
          Download
        </button>
        <button type="button" className="btn btn-ghost flex-1" onClick={handleCopy}>
          {copied ? "Copied" : "Copy image"}
        </button>
      </div>
    </div>
  );
}
