"use client";

import { useCallback, useRef, useState } from "react";

export default function Dropzone({
  onFile,
  onIntent,
  hasPhoto,
  busy,
}: {
  onFile: (file: File) => void;
  /** Fired on first hover/focus so the detector download can start early. */
  onIntent?: () => void;
  hasPhoto: boolean;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const warmed = useRef(false);

  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    onIntent?.();
  }, [onIntent]);

  const pick = () => {
    warm();
    inputRef.current?.click();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        // HEIC is listed explicitly: iOS reports an empty MIME type for it, and
        // without the extensions here the picker greys those photos out.
        accept="image/*,.heic,.heif,.HEIC,.HEIF"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          // Reset so re-picking the same file still fires a change event.
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={pick}
        onPointerEnter={warm}
        onFocus={warm}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
          warm();
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={busy}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed px-6 py-8 text-center transition-colors"
        style={{
          borderColor: dragging ? "var(--accent)" : "var(--hairline)",
          background: dragging ? "color-mix(in srgb, var(--accent) 6%, white)" : "var(--canvas)",
        }}
      >
        <span className="t-body-strong">
          {hasPhoto ? "Choose a different photo" : "Add your photo"}
        </span>
        <span className="t-fine">
          JPG · PNG · HEIC · WebP — drag one in, or tap to browse
        </span>
      </button>
    </div>
  );
}
