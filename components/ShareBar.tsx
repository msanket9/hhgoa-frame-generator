"use client";

import { useEffect, useState } from "react";

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

type PlatformKey = "share" | "instagram" | "link";

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Separate from `note` and doesn't self-clear: once staged, the link to
  // finish the Instagram hand-off should stay available, not vanish with the
  // timed confirmation text above it.
  const [instagramReady, setInstagramReady] = useState(false);
  const filename = fileNameFor(format, details.name);

  // Client-only: window isn't available during the server render, and this
  // stays "" for that one pass rather than risk a hydration mismatch.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    void (async () => setOrigin(window.location.origin))();
  }, []);
  // The share id is allocated up front (see the prop doc below), so the page
  // URL — and therefore every platform's intent URL — is known immediately,
  // with no upload to wait on. That's what makes real <a href> tags for
  // X/WhatsApp/Facebook possible below instead of a JS-triggered redirect.
  const pageUrl = origin ? `${origin}/s/${shareId}` : "";
  const xHref = intentUrl(pageUrl);
  const whatsappHref = whatsappUrl(SHARE_TEXT, pageUrl);
  const facebookHref = facebookShareUrl(pageUrl);

  const showNote = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(null), 3200);
  };

  /**
   * Fires on the same click as the real <a> tag's own navigation — doesn't
   * block it, doesn't navigate anywhere itself. The href already points at
   * the final URL, so all this has to do is make sure real data exists there
   * by the time the platform's app fetches it. Errors surface on this page,
   * not the one the tap just opened, since target="_blank" leaves this tab
   * right where it was.
   */
  const triggerUpload = () => {
    getShareBlobs()
      .then((shots) => {
        if (!shots) throw new Error("Couldn't prepare the image.");
        return uploadForShare(shots.image, shots.og, {
          id: shareId,
          name: details.name,
          title: details.title,
          format,
        });
      })
      .catch(() => {
        onError(
          "Couldn't upload the image — the link may take a moment to load, or attach the photo yourself.",
        );
      });
  };

  /**
   * Native share is tried first, not as a fallback.
   *
   * navigator.share() hands the photo file straight to whichever app the
   * person picks in the OS sheet, already attached, no URL for anything to
   * fetch. This is the main Share button's whole path on a phone that
   * supports it; the link-based fallback below only matters on desktop or a
   * browser that rejects the file.
   *
   * MUST be the very first thing this function does, with no `await` before
   * it — Safari drops user-activation across an await, so share() has to run
   * in the same tick as the click. That's also why it depends on `blob`
   * already being exported ahead of time rather than encoding on demand.
   */
  const tryNativeShare = async (): Promise<"shared" | "cancelled" | "unsupported"> => {
    if (!blob) return "unsupported";
    const file = blobToFile(blob, filename);
    if (!canShareFiles(file)) return "unsupported";
    return shareFile(file, SHARE_TEXT);
  };

  const handleShare = async () => {
    const result = await tryNativeShare();
    // "cancelled" = the user closed the sheet on purpose; leave them there
    // rather than bouncing them into a second, different share flow.
    // "unsupported" (Web Share rejected the file for some reason, e.g. an
    // over-large payload on some Android builds, or no Web Share support at
    // all as on most desktop browsers) falls through to the link below.
    if (result === "shared" || result === "cancelled") return;

    setBusy("share");
    try {
      const shots = await getShareBlobs();
      if (!shots) throw new Error("Couldn't prepare the image.");
      const { pageUrl: uploadedUrl } = await uploadForShare(shots.image, shots.og, {
        id: shareId,
        name: details.name,
        title: details.title,
        format,
      });
      window.location.href = intentUrl(uploadedUrl);
    } catch {
      window.location.href = intentUrl("");
      onError("Couldn't upload the image — download it and attach it to the post.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Instagram has no share intent anywhere — not a web endpoint, not a URL
   * scheme. There's nothing to hand it pre-filled, by Meta's design. The best
   * this can do is stage both pieces and point the person at the app.
   *
   * Deliberately doesn't navigate there automatically — the note below
   * carries a real link the person taps themselves. An automatic redirect
   * right after triggering a download is the same fragile pattern that broke
   * the other three buttons on iOS, and here it isn't needed: unlike X/
   * WhatsApp/Facebook there's no per-share URL to hand off, so there's
   * nothing gained by leaving this page before they've actually read the
   * instructions.
   */
  const handleInstagram = async () => {
    setBusy("instagram");
    try {
      const copiedCaption = await copyTextToClipboard(SHARE_TEXT);
      onDownload();
      setInstagramReady(true);
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

  /**
   * The link only means anything once the image is actually uploaded — a
   * copied /s/id URL for a share id nobody's pushed images to yet is a dead
   * page. So this uploads first, same as every platform button, and copies
   * the real page URL rather than guessing it client-side.
   */
  const handleCopyLink = async () => {
    setBusy("link");
    try {
      const shots = await getShareBlobs();
      if (!shots) throw new Error("Couldn't prepare the image.");

      const { pageUrl } = await uploadForShare(shots.image, shots.og, {
        id: shareId,
        name: details.name,
        title: details.title,
        format,
      });

      if (await copyTextToClipboard(pageUrl)) {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } else {
        onError("Couldn't copy the link — try again.");
      }
    } catch {
      onError("Couldn't prepare the link. Try again.");
    } finally {
      setBusy(null);
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

      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={handleCopyLink}
        disabled={busy !== null}
      >
        {busy === "link" ? "Copying…" : linkCopied ? "Link copied" : "Copy link"}
      </button>

      <div className="mt-1 flex flex-col items-center gap-2.5">
        <span className="t-fine">Or straight to</span>
        <div className="flex gap-3">
          {/* Real <a> tags, not buttons with a JS redirect — iOS only hands a
              tap off to the installed app (X, WhatsApp, Facebook) when the
              navigation comes from an actual link click. A programmatic
              `location.href` assignment reads as untrustworthy and just loads
              the mobile website instead, which was the whole bug. */}
          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            aria-label="Share to X"
            title="Share to X"
            onClick={triggerUpload}
          >
            <XGlyph />
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            aria-label="Share to WhatsApp"
            title="Share to WhatsApp"
            onClick={triggerUpload}
          >
            <WhatsAppGlyph />
          </a>
          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            aria-label="Share to Facebook"
            title="Share to Facebook"
            onClick={triggerUpload}
          >
            <FacebookGlyph />
          </a>
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
        {instagramReady && (
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="t-fine font-semibold underline underline-offset-2"
            style={{ color: "var(--pink)" }}
          >
            Open Instagram →
          </a>
        )}
      </div>
    </div>
  );
}
