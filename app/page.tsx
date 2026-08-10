import SiteHeader from "@/components/SiteHeader";
import Studio from "@/components/Studio";
import { BeachHut, PalmTree, Waves } from "@/components/illustrations";

/**
 * Illustrated parchment hero — palms, a beach hut, a hand-drawn horizon,
 * entrance motion. The tool itself (Studio) is unchanged in behaviour; only
 * the stage around it changed.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col overflow-x-hidden">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="dot-field" aria-hidden />

        <PalmTree className="anim-drift pointer-events-none absolute -left-4 top-4 h-40 w-auto opacity-90 sm:top-0 sm:h-56" />
        <PalmTree
          className="anim-drift pointer-events-none absolute -right-6 top-10 h-32 w-auto scale-x-[-1] opacity-80 sm:h-48"
          color="var(--pink)"
        />
        <BeachHut className="anim-bob pointer-events-none absolute right-4 bottom-2 hidden h-20 w-auto opacity-90 md:block" />

        <div className="relative mx-auto flex w-full max-w-[720px] flex-col items-center px-5 pb-10 pt-14 text-center sm:pt-20">
          <p className="anim-rise t-eyebrow rounded-full border-[1.5px] border-[var(--hairline)] bg-[var(--paper)] px-3 py-1.5">
            Oct 28–31 · 2026 · #FrameInGoa
          </p>

          <h1 className="anim-pop delay-1 t-display mt-5">
            Frame your <span style={{ color: "var(--pink)" }}>Goa</span> era
          </h1>

          <p className="anim-rise delay-2 t-lead mt-4 max-w-[46ch]">
            Drop a photo, get a builder pass or profile frame in seconds, post
            it with the hashtag. No login, no signup.
          </p>
        </div>

        <Waves className="relative block w-full" color="var(--green)" />
      </section>

      <div className="anim-pop delay-3 mx-auto w-full max-w-[640px] flex-1 px-5 pb-20 pt-6">
        <Studio />
      </div>

      <Waves className="block w-full rotate-180" color="var(--pink)" />
      <footer
        className="px-5 py-10 text-center"
        style={{ background: "var(--green)" }}
      >
        <p className="t-fine" style={{ color: "rgba(247,241,224,0.6)" }}>
          Oct 28–31, 2026 · Goa, India · unofficial fan-made tool ·{" "}
          <a
            href="https://hhgoa.com"
            className="underline underline-offset-2"
            style={{ color: "var(--cream)" }}
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
