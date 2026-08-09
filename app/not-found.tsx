import Link from "next/link";

/**
 * The realistic way to land here is a share link that expired, was mistyped,
 * or belongs to a frame that was never uploaded — so the page leads with that
 * rather than a generic "page not found", and offers the one useful action.
 */
export default function NotFound() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center"
    >
      <p className="t-eyebrow">Hacker House Goa · Oct 28–31, 2026</p>

      <h1 className="t-display mt-4 text-balance">
        This frame isn&apos;t here.
      </h1>

      <p className="t-lead mt-3 max-w-[34ch] text-balance">
        The link may be mistyped, or the frame was never finished.
      </p>

      <Link href="/" className="btn btn-primary mt-8">
        Make your own
      </Link>

      <p className="t-fine mt-4">No login. No signup. Takes about ten seconds.</p>
    </main>
  );
}
