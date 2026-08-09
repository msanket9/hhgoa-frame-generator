/**
 * Share to X.
 *
 * X web intents cannot attach media — there is no parameter for it. So there
 * are exactly two ways to get the actual graphic into a post, and which one is
 * available depends entirely on the device:
 *
 *   mobile   navigator.share({ files }) hands the PNG to the X app directly.
 *   desktop  upload, then post a link whose OG card renders the graphic.
 *
 * Both are implemented. Neither alone covers the brief.
 */

/**
 * Deliberately doesn't claim a spot — this is an application, not an
 * acceptance, and "locked in" would read as overclaiming to anyone who
 * actually gets selected later.
 */
export const SHARE_TEXT = [
  "Building at Hacker House Goa 2026. 🌅",
  "Oct 28–31 · Goa, India",
  "",
  "Less noise. More signal.",
  "#FrameInGoa",
].join("\n");

export function canShareFiles(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: blob.type || "image/png",
    lastModified: Date.now(),
  });
}

/**
 * MUST be called synchronously inside the user-gesture handler.
 *
 * Safari checks that share() happens within the activation window, and any
 * `await` before it — including awaiting canvas.toBlob — loses activation and
 * throws NotAllowedError. The caller keeps a pre-exported blob in state for
 * exactly this reason.
 */
export async function shareFile(file: File, text = SHARE_TEXT): Promise<
  "shared" | "cancelled" | "unsupported"
> {
  if (!canShareFiles(file)) return "unsupported";
  try {
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unsupported";
  }
}

export type UploadResult = { id: string; pageUrl: string; imageUrl: string };

/**
 * Uploads the square graphic plus a 1200x630 OG variant.
 *
 * The variant is not optional: X's summary_large_image card centre-crops to
 * roughly 2:1, so handing it the 1080x1080 would slice the top and bottom off
 * the ring — the degraded preview the brief explicitly warns about.
 */
export async function uploadForShare(
  image: Blob,
  ogImage: Blob,
  meta: { name?: string; title?: string },
): Promise<UploadResult> {
  const body = new FormData();
  body.append("image", image, "image.png");
  body.append("og", ogImage, "og.png");
  if (meta.name) body.append("name", meta.name);
  if (meta.title) body.append("title", meta.title);

  const res = await fetch("/api/share", { method: "POST", body });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return (await res.json()) as UploadResult;
}

export function intentUrl(pageUrl: string, text = SHARE_TEXT): string {
  const params = new URLSearchParams({ text, url: pageUrl });
  return `https://x.com/intent/tweet?${params.toString()}`;
}

/**
 * Copy to clipboard — on desktop this is actually the fastest path, since the
 * X composer accepts a pasted image directly.
 *
 * Safari requires the ClipboardItem to be constructed with a promise rather
 * than a resolved Blob when anything async precedes it, so callers pass an
 * already-resolved blob and we keep this synchronous up to the write.
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
