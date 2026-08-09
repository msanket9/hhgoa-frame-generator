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
    <div role="tablist" aria-label="Format" className="segmented">
      {ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === value}
          onClick={() => onChange(id)}
        >
          {FORMATS[id].label}
        </button>
      ))}
    </div>
  );
}
