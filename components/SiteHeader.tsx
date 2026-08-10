import Link from "next/link";

import { Sunburst } from "./illustrations";

/**
 * Persistent top bar across every page — logo, consistent wherever you land:
 * the generator, a share page, or a 404.
 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b-[1.5px] border-[var(--hairline)] bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Sunburst size={30} />
          <div className="leading-tight">
            <p className="t-display-sm !text-[1.05rem] !leading-none">Frame in Goa</p>
            <p className="t-fine !text-[0.62rem] leading-none">HH GOA · 2026 EDITION</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
