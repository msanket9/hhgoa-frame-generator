import Studio from "@/components/Studio";

/**
 * One calm surface, one centred column, one job.
 *
 * The earlier split-column layout left a dead vertical gap beside the preview
 * and pushed the actions into it, which read as unfinished. A single column
 * also means the whole tool fits one viewport on a phone.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col" style={{ background: "var(--canvas-parchment)" }}>
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center px-5 pb-16 pt-10 sm:pt-14">
        <p className="t-eyebrow">Hacker House Goa · Oct 28–31, 2026</p>
        <h1 className="t-display mt-3 text-center text-balance">
          Less noise. More signal.
        </h1>
        <p className="t-caption mt-2 mb-8 text-center text-ink-muted-48">
          Drop a photo. Get your frame. Post it.
        </p>

        <Studio />
      </div>

      <footer className="px-5 pb-10 text-center">
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
