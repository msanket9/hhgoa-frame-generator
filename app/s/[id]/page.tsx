import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { head } from "@vercel/blob";

export const revalidate = 3600;

type Frame = {
  name: string;
  title: string;
  image: string;
  og: string;
  createdAt: number;
};

/**
 * Metadata lives in a JSON blob next to the images, so a shared link needs no
 * database — the whole share feature stays stateless.
 */
async function getFrame(id: string): Promise<Frame | null> {
  if (!/^[A-Za-z0-9_-]{6,24}$/.test(id)) return null;

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const meta = await head(`frames/${id}.json`);
      const res = await fetch(meta.url, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      return (await res.json()) as Frame;
    }

    // Local dev fallback — mirrors the local branch in /api/share so the
    // share page and its OG tags are exercisable without a Blob store.
    if (process.env.NODE_ENV !== "production") {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const file = path.join(process.cwd(), "public", "devshares", `${id}.json`);
      return JSON.parse(await readFile(file, "utf8")) as Frame;
    }

    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const frame = await getFrame(id);

  if (!frame) {
    return { title: "Frame in Goa — Hacker House Goa 2026" };
  }

  const who = frame.name?.trim() || "A builder";
  const title = `${who} is going to Hacker House Goa 2026`;
  const description = frame.title
    ? `${frame.title} · Oct 28–31, 2026 · Goa, India`
    : "Oct 28–31, 2026 · Goa, India";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      // The dedicated 2:1 variant. Handing X the 1080x1080 would get
      // centre-cropped and slice the frame apart.
      images: [{ url: frame.og, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [frame.og],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const frame = await getFrame(id);
  if (!frame) notFound();

  const who = frame.name?.trim() || "A builder";

  return (
    <main className="flex flex-1 flex-col">
      <section className="tile tile-parchment flex flex-1 flex-col items-center justify-center text-center">
        {/* Plain <img> on purpose: this is a PNG we generated at exactly the
            size we want, on a blob host. next/image would re-encode it through
            the optimizer for no quality gain and a per-image cost. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image}
          alt={`${who}'s Hacker House Goa 2026 frame`}
          width={520}
          height={520}
          className="product-shadow w-full max-w-[420px] rounded-[18px]"
        />

        <h1 className="t-display mt-10">{who}</h1>
        {frame.title && (
          <p className="t-lead mt-2" style={{ color: "var(--accent)" }}>
            {frame.title}
          </p>
        )}
        <p className="t-caption mt-4 text-ink-muted-48">
          Hacker House Goa · Oct 28–31, 2026
        </p>

        <Link href="/" className="btn btn-primary mt-10">
          Make yours
        </Link>
      </section>
    </main>
  );
}
