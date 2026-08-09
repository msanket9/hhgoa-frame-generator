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
 */
async function putLocal(name: string, data: Blob | string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "devshares");
  await mkdir(dir, { recursive: true });
  const bytes =
    typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(await data.arrayBuffer());
  await writeFile(path.join(dir, name), bytes);
  return `/devshares/${name}`;
}

export async function POST(request: Request) {
  if (!hasBlob() && !isDev) {
    // Without storage there's no link to share. Say so plainly so the client
    // can fall back to download-and-attach rather than failing silently.
    return new NextResponse("Sharing by link isn't configured.", {
      status: 503,
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
  if (image.size > MAX_BYTES || og.size > MAX_BYTES) {
    return badRequest("Image too large.");
  }
  if (
    (image.type && image.type !== "image/png") ||
    (og.type && og.type !== "image/png")
  ) {
    return badRequest("Only PNG is accepted.");
  }

  const id = nanoid(10);
  const name = String(form.get("name") ?? "").slice(0, 60);
  const title = String(form.get("title") ?? "").slice(0, 60);

  try {
    const origin = new URL(request.url).origin;

    let imageUrl: string;
    let ogUrl: string;

    if (hasBlob()) {
      const [stored, storedOg] = await Promise.all([
        put(`frames/${id}.png`, image, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          cacheControlMaxAge: 31536000,
        }),
        put(`frames/${id}-og.png`, og, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          cacheControlMaxAge: 31536000,
        }),
      ]);
      imageUrl = stored.url;
      ogUrl = storedOg.url;
    } else {
      imageUrl = origin + (await putLocal(`${id}.png`, image));
      ogUrl = origin + (await putLocal(`${id}-og.png`, og));
    }

    // Metadata rides alongside as JSON so the share page can render without a
    // database — this whole feature stays stateless.
    const meta = JSON.stringify({
      name,
      title,
      image: imageUrl,
      og: ogUrl,
      createdAt: Date.now(),
    });

    if (hasBlob()) {
      await put(`frames/${id}.json`, meta, {
        access: "public",
        addRandomSuffix: false,
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
