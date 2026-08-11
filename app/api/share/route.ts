import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const isDev = process.env.NODE_ENV !== "production";

function badRequest(message: string) {
  return new NextResponse(message, { status: 400 });
}

/**
 * Local stand-in for Blob storage so the whole share flow — upload, share
 * page, OG tags — can be exercised with `npm run dev` before any deploy.
 * Development only; production always requires real storage.
 *
 * `name` is only ever called with `${id}.${ext}` where `id` has already
 * passed the alnum/dash/underscore regex below and `ext` is a hardcoded
 * literal — but the check here is defense-in-depth: this function writes to
 * disk from network input, and it should refuse a path-breaking name on its
 * own rather than trust every future caller to have validated one upstream.
 */
async function putLocal(name: string, data: Blob | string): Promise<string> {
  if (!/^[A-Za-z0-9_.-]+$/.test(name) || name.includes("..")) {
    throw new Error("Refusing to write an unsafe filename.");
  }
  const dir = path.join(process.cwd(), "public", "devshares");
  await mkdir(dir, { recursive: true });
  const bytes =
    typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(await data.arrayBuffer());
  await writeFile(path.join(dir, name), bytes);
  return `/devshares/${name}`;
}

/**
 * Confirms the bytes actually are what the declared Content-Type claims.
 *
 * The client always sends a canvas-produced PNG/JPEG, so `Blob.type` is
 * trustworthy from our own UI — but this endpoint is reachable directly, and
 * nothing stops a POST claiming `image/png` while the body is arbitrary
 * bytes. We only allow-list two content-types and always re-set the
 * Content-Type header ourselves rather than echo the client's, so this isn't
 * exploitable as stored XSS — but sniffing the real signature means what's
 * served is provably an image of the type we say it is, not just labelled
 * one, and it stops the storage from filling up with non-image junk.
 */
async function sniffImageType(blob: Blob): Promise<"image/png" | "image/jpeg" | null> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const isPng =
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a;
  if (isPng) return "image/png";

  const isJpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (isJpeg) return "image/jpeg";

  return null;
}

/**
 * Strips control and bidi-override characters from user-entered text before
 * it flows into OG/Twitter meta tags and the page <title>.
 *
 * React/Next escape these for HTML correctly either way — this isn't an XSS
 * gap — but an unfiltered name field is still a place to smuggle bidi
 * override characters (used to visually disguise text) or raw control bytes
 * into a link preview. Free-text display fields get the same treatment any
 * social product applies to a display name.
 */
function sanitizeText(input: string, maxLen: number): string {
  return input
    // Whitespace-like controls (tab, CR, LF, vertical tab, form feed, the
    // unicode line/paragraph separators) become a plain space first — order
    // matters here. Stripping them in the same pass as the non-whitespace
    // controls below would delete them outright instead of separating words,
    // gluing "Sanket\nMarathe" into "SanketMarathe".
    .replace(/[\t\n\r\v\f\u2028\u2029]/g, " ")
    // Remaining C0/C1 controls and the bidi override/isolate marks (used to
    // visually disguise text) are dropped outright — they carry no meaning
    // as a word separator.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Per-instance sliding-window rate limit.
 *
 * This is an anonymous, unauthenticated write endpoint backed by paid Blob
 * storage — worth a real limit even though a serverless deployment means
 * each warm instance keeps its own counter (so the true ceiling under
 * distributed load is `limit x concurrent instances`, not a global cap).
 * Still closes off casual scripted abuse from a single client, which is the
 * realistic threat here; a global limit would need shared storage (Redis/KV)
 * this project doesn't provision.
 */
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // Bound the map itself so a flood of distinct IPs can't grow it forever.
  if (hits.size > 5000) {
    const cutoff = now - RATE_WINDOW_MS;
    for (const [k, times] of hits) {
      if (!times.some((t) => t > cutoff)) hits.delete(k);
    }
  }

  return recent.length > RATE_LIMIT;
}

function clientKey(request: Request): string {
  // Vercel sets this; falls back to a shared bucket off-platform (dev) rather
  // than disabling the limiter outright.
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
}

/**
 * multipart/form-data POSTs are a CORS "simple request" — any third-party
 * page can point a plain <form> at this endpoint and it fires cross-origin
 * with no preflight. There's no session cookie here for that to steal, so
 * this isn't a CSRF-with-impact bug, but it is a free amplifier for storage
 * abuse from a page we don't control. Reject anything that doesn't claim to
 * come from this origin.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches often omit Origin
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!hasBlob() && !isDev) {
    // Without storage there's no link to share. Say so plainly so the client
    // can fall back to download-and-attach rather than failing silently.
    return new NextResponse("Sharing by link isn't configured.", {
      status: 503,
    });
  }

  if (!isSameOrigin(request)) {
    return new NextResponse("Cross-origin uploads are not allowed.", {
      status: 403,
    });
  }

  if (isRateLimited(clientKey(request))) {
    return new NextResponse("Too many uploads. Try again in a minute.", {
      status: 429,
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Malformed upload.");
  }

  const image = form.get("image");
  const og = form.get("og");

  if (!(image instanceof Blob) || !(og instanceof Blob)) {
    return badRequest("Missing image.");
  }
  if (image.size === 0 || og.size === 0) {
    return badRequest("Empty file.");
  }
  if (image.size > MAX_BYTES || og.size > MAX_BYTES) {
    return badRequest("Image too large.");
  }

  const [sniffedImage, sniffedOg] = await Promise.all([
    sniffImageType(image),
    sniffImageType(og),
  ]);
  if (!sniffedImage || !sniffedOg) {
    return badRequest("File content doesn't match an accepted image format.");
  }
  // The Content-Type we store and serve is the sniffed one, never the
  // client-declared one — so even a deliberately mislabelled upload gets
  // stored under the type its bytes actually are.
  const ext = sniffedImage === "image/jpeg" ? "jpg" : "png";
  const ogExt = sniffedOg === "image/jpeg" ? "jpg" : "png";

  // The client allocates the id so the card's QR can encode the final URL
  // before the image is rendered. Validated hard; anything odd falls back to a
  // server-generated id.
  const requested = String(form.get("id") ?? "");
  const id = /^[A-Za-z0-9_-]{6,24}$/.test(requested) ? requested : nanoid(10);
  const name = sanitizeText(String(form.get("name") ?? ""), 60);
  const title = sanitizeText(String(form.get("title") ?? ""), 60);
  // Determines how the share page displays the image (circular avatar vs.
  // the rectangular pass) — an unrecognized value falls back to "pfp" rather
  // than 400ing the whole upload over a cosmetic field.
  const rawFormat = String(form.get("format") ?? "");
  const format = rawFormat === "card" ? "card" : "pfp";

  try {
    const origin = new URL(request.url).origin;

    let imageUrl: string;
    let ogUrl: string;

    if (hasBlob()) {
      const [stored, storedOg] = await Promise.all([
        put(`frames/${id}.${ext}`, image, {
          access: "public",
          addRandomSuffix: false,
          // The share id is fixed for the whole session (baked into the
          // card's QR), so tweaking a theme and sharing again reuses the same
          // pathname. Without this, Vercel Blob throws on the second share —
          // by default it refuses to overwrite an existing blob.
          allowOverwrite: true,
          contentType: sniffedImage,
          cacheControlMaxAge: 31536000,
        }),
        put(`frames/${id}-og.${ogExt}`, og, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: sniffedOg,
          cacheControlMaxAge: 31536000,
        }),
      ]);
      imageUrl = stored.url;
      ogUrl = storedOg.url;
    } else {
      imageUrl = origin + (await putLocal(`${id}.${ext}`, image));
      ogUrl = origin + (await putLocal(`${id}-og.${ogExt}`, og));
    }

    // Metadata rides alongside as JSON so the share page can render without a
    // database — this whole feature stays stateless.
    const meta = JSON.stringify({
      name,
      title,
      format,
      image: imageUrl,
      og: ogUrl,
      createdAt: Date.now(),
    });

    if (hasBlob()) {
      await put(`frames/${id}.json`, meta, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 31536000,
      });
    } else {
      await putLocal(`${id}.json`, meta);
    }

    return NextResponse.json({
      id,
      pageUrl: `${origin}/s/${id}`,
      imageUrl,
    });
  } catch {
    return new NextResponse("Upload failed.", { status: 502 });
  }
}
