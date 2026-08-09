import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Dev-only: writes a rendered canvas to disk so the artifact can be inspected
 * as a real image file during design iteration. Never runs in production.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const name = String(form.get("name") ?? "snap.png").replace(/[^\w.-]/g, "");
  if (!(file instanceof Blob)) {
    return new NextResponse("Missing file", { status: 400 });
  }

  const dir = path.join(process.cwd(), ".devsnaps");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, name);
  await writeFile(out, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ ok: true, path: out });
}
