import Studio from "@/components/Studio";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero. One idea, a lot of air, and the tool immediately below —
          no marketing scroll between the user and the thing they came for. */}
      {/* Tighter than the standard tile rhythm on small screens — every pixel
          here pushes the upload further from the fold. */}
      <section className="px-5 pb-8 pt-9 text-center sm:pb-12 sm:pt-14 lg:tile">
        <div className="mx-auto max-w-[720px]">
          <p className="t-eyebrow">Hacker House Goa · Oct 28–31, 2026</p>
          <h1 className="t-hero mt-3 sm:mt-5">
            Less noise.
            <br />
            More signal.
          </h1>
          <p className="t-lead mx-auto mt-3 max-w-[540px] sm:mt-5">
            Drop a photo. Get your frame. Post it.
          </p>
        </div>
      </section>

      <Studio />

      <footer className="tile-parchment px-6 py-10 text-center">
        <p className="t-fine">
          Unofficial fan-made tool for Hacker House Goa 2026 ·{" "}
          <a
            href="https://hhgoa.com"
            className="underline"
            style={{ color: "var(--accent)" }}
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
