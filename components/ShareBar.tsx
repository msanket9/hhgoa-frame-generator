"use client";

import { useState } from "react";

import { fileNameFor } from "@/lib/export";
import type { Details, FormatId } from "@/lib/render/types";
import {
  SHARE_TEXT,
  blobToFile,
  canShareFiles,
  copyImageToClipboard,
  copyTextToClipboard,
  facebookShareUrl,
  intentUrl,
  shareFile,
  uploadForShare,
  whatsappUrl,
} from "@/lib/share";

import { EnvelopeIcon } from "./illustrations";
import {
  FacebookGlyph,
  InstagramGlyph,
  WhatsAppGlyph,
  XGlyph,
} from "./SocialIcons";

type PlatformKey = "share" | "x" | "whatsapp" | "facebook" | "instagram";

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
  const [busy, setBusy] = useState<PlatformKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const filename = fileNameFor(format, details.name);

  const showNote = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(null), 3200);
  };

  /**
   * Native share is tried first, not as a fallback.
   *
   * X's own web intent has to unfurl our /s/id page to build its link card,
   * and that step is exactly what was failing inside X's in-app browser
   * ("failed to load content") — a link-preview fetch with real failure modes
   * (cold start, redirect, timeout) sitting between the tap and the post.
   * navigator.share() skips all of that: iOS and Android hand the photo file
   * straight to whichever app the person picks in the OS sheet, already
   * attached, nothing to fetch.
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

    await openViaLink((pageUrl) => intentUrl(pageUrl), "share");
  };

  /**
   * Shared by every per-platform button: upload once, then hand the
   * resulting page link to that platform's own share URL. Each of these is a
   * genuine deep link — opened as a real top-level navigation on a phone
   * with the app installed, X/WhatsApp/Facebook all hand off into the app
   * itself already composing, not into the mobile website.
   */
  const openViaLink = async (
    buildUrl: (pageUrl: string) => string,
    key: PlatformKey,
  ) => {
    // Opened synchronously where possible; popup blockers reject a
    // window.open that happens after an await. No `noopener` — that makes
    // window.open return null, and the handle is what we redirect below.
    const popup = window.open("about:blank", "_blank");
    setBusy(key);

    try {
      const shots = await getShareBlobs();
      if (!shots) throw new Error("Couldn't prepare the image.");

      const { pageUrl } = await uploadForShare(shots.image, shots.og, {
        id: shareId,
        name: details.name,
        title: details.title,
        format,
      });
      const url = buildUrl(pageUrl);

      if (popup && !popup.closed) popup.location.href = url;
      else window.location.href = url;
    } catch {
      // Still get them to the platform with the caption ready; they can
      // attach the downloaded image themselves rather than hitting a dead end.
      const fallback = buildUrl("");
      if (popup && !popup.closed) popup.location.href = fallback;
      else window.location.href = fallback;
      onError("Couldn't upload the image — download it and attach it to the post.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Instagram has no share intent anywhere — not a web endpoint, not a URL
   * scheme. There's nothing to hand it pre-filled, by Meta's design. The best
   * this can do is stage both pieces and open the app to paste into.
   */
  const handleInstagram = async () => {
    setBusy("instagram");
    try {
      const copiedCaption = await copyTextToClipboard(SHARE_TEXT);
      onDownload();
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      showNote(
        copiedCaption
          ? "Caption copied, photo downloading — paste both into Instagram."
          : "Photo downloading — attach it in Instagram and add #FrameInGoa yourself.",
      );
    } finally {
      setBusy(null);
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
        className="btn btn-stamp w-full"
        onClick={handleShare}
        disabled={busy !== null}
      >
        {busy === "share" ? "Opening…" : (
          <>
            <EnvelopeIcon /> Share
          </>
        )}
      </button>

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost flex-1" onClick={onDownload}>
          Download
        </button>
        <button type="button" className="btn btn-ghost flex-1" onClick={handleCopy}>
          {copied ? "Copied" : "Copy image"}
        </button>
      </div>

      <div className="mt-1 flex flex-col items-center gap-2.5">
        <span className="t-fine">Or straight to</span>
        <div className="flex gap-3">
          <button
            type="button"
            className="icon-btn"
            aria-label="Share to X"
            title="Share to X"
            onClick={() => openViaLink((pageUrl) => intentUrl(pageUrl), "x")}
            disabled={busy !== null}
          >
            <XGlyph />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Share to WhatsApp"
            title="Share to WhatsApp"
            onClick={() =>
              openViaLink((pageUrl) => whatsappUrl(SHARE_TEXT, pageUrl), "whatsapp")
            }
            disabled={busy !== null}
          >
            <WhatsAppGlyph />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Share to Facebook"
            title="Share to Facebook"
            onClick={() => openViaLink((pageUrl) => facebookShareUrl(pageUrl), "facebook")}
            disabled={busy !== null}
          >
            <FacebookGlyph />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Prep for Instagram"
            title="Copy caption, download photo, open Instagram"
            onClick={handleInstagram}
            disabled={busy !== null}
          >
            <InstagramGlyph />
          </button>
        </div>
        {note && (
          <p className="t-fine text-center" style={{ color: "var(--green)" }}>
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
