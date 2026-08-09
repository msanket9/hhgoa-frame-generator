import Studio from "@/components/Studio";

/**
 * A dark room with one lit object.
 *
 * The header is deliberately small: in a gallery the wall text never competes
 * with the work. Scale belongs to the artifact, so everything else here is
 * sized down rather than up.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center px-5 pb-20 pt-8 sm:pt-12">
        <p className="t-eyebrow">Frame in Goa · HH Goa 2026</p>

        <Studio />
      </div>

      <footer className="px-5 pb-10 text-center">
        <p className="t-fine">
          Oct 28–31, 2026 · Goa, India · unofficial fan-made tool ·{" "}
          <a
            href="https://hhgoa.com"
            className="underline underline-offset-2"
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
