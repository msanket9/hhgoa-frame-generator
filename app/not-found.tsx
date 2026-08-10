import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import { PalmTree, Postmark, Waves } from "@/components/illustrations";

/**
 * The realistic way to land here is a share link that expired, was mistyped,
 * or belongs to a frame that was never uploaded — so the page leads with that
 * rather than a generic "page not found", and offers the one useful action.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col overflow-x-hidden">
      <SiteHeader />

      <section className="relative flex-1 overflow-hidden">
        <div className="dot-field" aria-hidden />
        <PalmTree className="anim-drift pointer-events-none absolute -left-6 top-10 h-32 w-auto opacity-70 sm:h-44" />
        <PalmTree
          className="anim-drift pointer-events-none absolute -right-4 top-6 h-28 w-auto scale-x-[-1] opacity-60 sm:h-40"
          color="var(--pink)"
        />

        <div className="relative flex flex-col items-center px-5 py-20 text-center sm:py-28">
          <div className="anim-pop">
            <Postmark label="RETURN TO SENDER" sub="NOT FOUND" size={92} />
          </div>

          <h1 className="anim-rise delay-1 t-display mt-6 text-balance">
            This frame isn&apos;t here.
          </h1>

          <p className="anim-rise delay-2 t-lead mt-3 max-w-[34ch] text-balance">
            The link may be mistyped, or the frame was never finished.
          </p>

          <Link href="/" className="anim-rise delay-3 btn btn-stamp mt-8">
            Make your own
          </Link>

          <p className="t-fine mt-4">No login. No signup. Takes about ten seconds.</p>
        </div>

        <Waves className="relative block w-full" color="var(--green)" />
      </section>

      <footer className="px-5 py-10 text-center" style={{ background: "var(--green)" }}>
        <p className="t-fine" style={{ color: "rgba(247,241,224,0.6)" }}>
          Oct 28–31, 2026 · Goa, India · unofficial fan-made tool
        </p>
      </footer>
    </main>
  );
}
