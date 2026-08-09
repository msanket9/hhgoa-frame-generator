import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { head } from "@vercel/blob";

/**
 * Always rendered fresh.
 *
 * With ISR, a single transient miss on the metadata blob would bake a 404 into
 * the cache for the whole revalidate window — and the one visitor guaranteed to
 * hit this page early is X's crawler, so a cached 404 would kill the card for
 * everyone who saw the post.
 */
export const dynamic = "force-dynamic";

type Frame = {
  name: string;
  title: string;
  image: string;
  og: string;
  createdAt: number;
};

/**
 * Metadata lives in a JSON blob next to the images, so a shared link needs no
 * database. Reads are retried briefly: the link is opened within seconds of
 * being written, and blob reads aren't guaranteed to be immediately consistent
 * from every edge region.
 */
async function getFrame(id: string): Promise<Frame | null> {
  if (!/^[A-Za-z0-9_-]{6,24}$/.test(id)) return null;

  const readBlob = async (): Promise<Frame | null> => {
    const meta = await head(`frames/${id}.json`);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Frame;
  };

  const readLocal = async (): Promise<Frame | null> => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "public", "devshares", `${id}.json`);
    return JSON.parse(await readFile(file, "utf8")) as Frame;
  };

  const read = process.env.BLOB_READ_WRITE_TOKEN
    ? readBlob
    : process.env.NODE_ENV !== "production"
      ? readLocal
      : null;
  if (!read) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const frame = await read();
      if (frame) return frame;
    } catch {
      /* fall through to retry */
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  return null;
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

  const who = frame.name?.trim();
  const title = who
    ? `${who} is building at Hacker House Goa 2026`
    : "Building at Hacker House Goa 2026";
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

  const who = frame.name?.trim();

  return (
    <main className="flex flex-1 flex-col">
      {/* Near-black tile, not the brand green — the frame is itself green, and
          on a green field it would sit flat instead of reading as an object. */}
      <section className="tile tile-dark flex flex-col items-center text-center">
        <p className="t-eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
          Hacker House Goa · Oct 28–31, 2026
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image}
          alt={
            who
              ? `${who}'s Hacker House Goa 2026 frame`
              : "A Hacker House Goa 2026 frame"
          }
          width={400}
          height={400}
          className="product-shadow mt-8 w-full max-w-[360px] rounded-full"
        />

        {/* With no name — the profile-frame path doesn't ask for one — the
            builder title carries the heading rather than a hollow placeholder. */}
        {who ? (
          <>
            <h1 className="t-display mt-9">{who}</h1>
            {frame.title && (
              <p
                className="t-tagline mt-2"
                style={{ color: "var(--accent-on-dark)" }}
              >
                {frame.title}
              </p>
            )}
          </>
        ) : (
          <h1
            className="t-display mt-9"
            style={{ color: "var(--accent-on-dark)" }}
          >
            {frame.title || "Building in Goa"}
          </h1>
        )}

        <p className="t-caption mt-4" style={{ color: "var(--body-muted)" }}>
          Less noise. More signal.
        </p>
      </section>

      {/* The reason this page exists: everyone arriving from X is a visitor who
          hasn't made one yet. */}
      <section className="tile flex flex-col items-center text-center">
        <h2 className="t-display">Make your own.</h2>
        <p className="t-lead mt-3 max-w-[30ch] text-balance">
          Drop a photo. Get your frame. Post it.
        </p>

        <Link href="/" className="btn btn-primary mt-8">
          Create your frame
        </Link>

        <p className="t-fine mt-4">
          No login. No signup. Takes about ten seconds.
        </p>
      </section>

      <footer
        className="px-5 py-8 text-center"
        style={{ background: "var(--canvas-parchment)" }}
      >
        <p className="t-fine">
          Unofficial fan-made tool ·{" "}
          <a
            href="https://hhgoa.com"
            className="underline underline-offset-2"
            style={{ color: "var(--ink-muted-48)" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            hhgoa.com
          </a>
        </p>
      </footer>
    </main>
  );
}
