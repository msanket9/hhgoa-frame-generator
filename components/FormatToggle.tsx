"use client";

import { FORMATS, type FormatId } from "@/lib/render/types";

const ORDER: FormatId[] = ["pfp", "card"];

export default function FormatToggle({
  value,
  onChange,
}: {
  value: FormatId;
  onChange: (id: FormatId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Format"
      className="mx-auto flex w-full max-w-[520px] gap-1 rounded-full bg-white p-1"
      style={{ border: "1px solid var(--hairline)" }}
    >
      {ORDER.map((id) => {
        const spec = FORMATS[id];
        const active = id === value;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            // whitespace-normal overrides .btn's nowrap — at 375px the labels
            // otherwise force the page into horizontal scroll.
            className="btn min-w-0 flex-1 flex-col !gap-0.5 !whitespace-normal !px-3 !py-2"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--on-accent)" : "var(--ink)",
            }}
          >
            <span className="t-caption-strong">{spec.label}</span>
            <span
              className="t-fine"
              style={{ color: active ? "rgba(255,255,255,0.8)" : undefined }}
            >
              {spec.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
