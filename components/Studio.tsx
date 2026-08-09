"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { PHOTO_WINDOW, autoFrame, warmDetector } from "@/lib/autoframe";
import { DecodeError, decodeImage, looksLikeImage } from "@/lib/decode";
import { canvasToBlob, downloadBlob, fileNameFor } from "@/lib/export";
import { renderOg } from "@/lib/render/og";
import {
  FORMATS,
  type Details,
  type FormatId,
  MAX_SCALE,
  MIN_SCALE,
  type RenderState,
  type Transform,
  clampTransform,
  renderToAsync,
} from "@/lib/render";
import { titleFor } from "@/lib/titles";

import Dropzone from "./Dropzone";
import FormatToggle from "./FormatToggle";
import ShareBar from "./ShareBar";

const EMPTY_DETAILS: Details = {
  name: "",
  role: "",
  stack: "",
  handle: "",
  title: "",
};

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [format, setFormat] = useState<FormatId>("pfp");
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [titleSalt, setTitleSalt] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFramed, setAutoFramed] = useState(false);
  const [, startTransition] = useTransition();

  // Kept current so the share handler has bytes ready without awaiting —
  // Safari drops user activation across an await and rejects share().
  const [exported, setExported] = useState<Blob | null>(null);

  const title = useMemo(
    () => details.title || titleFor(details.name, titleSalt),
    [details.title, details.name, titleSalt],
  );

  const renderState: RenderState = useMemo(
    () => ({ bitmap, transform, details: { ...details, title } }),
    [bitmap, transform, details, title],
  );

  /* ----------------------------------------------------------------------
     Render
     ---------------------------------------------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    void (async () => {
      await renderToAsync(canvas, format, renderState);
      if (cancelled) return;
      // Re-export lazily so the share button always has fresh bytes.
      try {
        const blob = await canvasToBlob(canvas);
        if (!cancelled) setExported(blob);
      } catch {
        /* export retried on demand */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [format, renderState]);

  /* ----------------------------------------------------------------------
     Upload
     ---------------------------------------------------------------------- */

  const handleFile = useCallback(
    async (file: File) => {
      if (!looksLikeImage(file)) {
        setError("That doesn't look like an image file.");
        return;
      }

      setBusy(true);
      setError(null);
      setAutoFramed(false);

      try {
        const decoded = await decodeImage(file);

        // Show the centre crop immediately; auto-framing refines it a beat
        // later. Waiting on the detector here would make upload feel slow.
        setBitmap((prev) => {
          prev?.close();
          return decoded.bitmap;
        });
        setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setBusy(false);

        const win = PHOTO_WINDOW[format];
        const result = await autoFrame(decoded.bitmap, win.w, win.h);
        if (result.foundFace) {
          startTransition(() => {
            setTransform(
              clampTransform(decoded.bitmap, result.transform, win.w, win.h),
            );
            setAutoFramed(true);
          });
        }
      } catch (err) {
        setBusy(false);
        setError(
          err instanceof DecodeError
            ? err.message
            : "Something went wrong reading that photo.",
        );
      }
    },
    [format],
  );

  // Re-solve framing when switching formats — the photo window changes shape,
  // so the same transform would sit differently.
  useEffect(() => {
    if (!bitmap || !autoFramed) return;
    const win = PHOTO_WINDOW[format];
    let cancelled = false;
    void autoFrame(bitmap, win.w, win.h).then((r) => {
      if (!cancelled && r.foundFace) {
        setTransform(clampTransform(bitmap, r.transform, win.w, win.h));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  /* ----------------------------------------------------------------------
     Drag to pan
     ---------------------------------------------------------------------- */

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Transform;
    rect: DOMRect;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bitmap) return;
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: transform,
      rect: canvas.getBoundingClientRect(),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || !bitmap || drag.pointerId !== e.pointerId) return;

    // Offsets are window fractions, so displayed pixels convert directly.
    const dx = (e.clientX - drag.startX) / drag.rect.width;
    const dy = (e.clientY - drag.startY) / drag.rect.height;

    const win = PHOTO_WINDOW[format];
    setTransform(
      clampTransform(
        bitmap,
        {
          scale: drag.origin.scale,
          offsetX: drag.origin.offsetX + dx,
          offsetY: drag.origin.offsetY + dy,
        },
        win.w,
        win.h,
      ),
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const onScaleChange = (scale: number) => {
    if (!bitmap) return;
    const win = PHOTO_WINDOW[format];
    setTransform((t) =>
      clampTransform(bitmap, { ...t, scale }, win.w, win.h),
    );
  };

  /* ----------------------------------------------------------------------
     Output
     ---------------------------------------------------------------------- */

  const ensureBlob = useCallback(async (): Promise<Blob | null> => {
    if (exported) return exported;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      const blob = await canvasToBlob(canvas);
      setExported(blob);
      return blob;
    } catch {
      return null;
    }
  }, [exported]);

  const handleDownload = useCallback(async () => {
    const blob = await ensureBlob();
    if (!blob) {
      setError("Couldn't export the image. Try again.");
      return;
    }
    downloadBlob(blob, fileNameFor(format, details.name));
  }, [ensureBlob, format, details.name]);

  const buildOgBlob = useCallback(async (): Promise<Blob | null> => {
    const source = canvasRef.current;
    if (!source) return null;
    const og = document.createElement("canvas");
    og.width = 1200;
    og.height = 630;
    const ctx = og.getContext("2d");
    if (!ctx) return null;
    renderOg(ctx, source, { ...details, title });
    try {
      return await canvasToBlob(og);
    } catch {
      return null;
    }
  }, [details, title]);

  const spec = FORMATS[format];

  return (
    <>
      <section className="tile-parchment px-5 pb-14 pt-8 sm:px-8 sm:pt-12 lg:tile">
        <div className="mx-auto w-full max-w-[1100px]">
          <FormatToggle value={format} onChange={setFormat} />

          {/* On mobile the upload lands directly under the hero — with the
              preview first it sat at the fold, which buries the one action
              every visitor came to take. On desktop it returns to the top of
              the right column via explicit grid placement. */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="order-1 flex flex-col gap-4 lg:order-2 lg:col-start-2 lg:row-start-1">
              <Dropzone
                onFile={handleFile}
                onIntent={warmDetector}
                hasPhoto={Boolean(bitmap)}
                busy={busy}
              />

              {error && (
                <p
                  role="alert"
                  className="t-caption rounded-[11px] bg-[#fdeee9] px-4 py-3 text-[#a03412]"
                >
                  {error}
                </p>
              )}
            </div>

            {/* Preview ------------------------------------------------- */}
            <div className="order-2 flex flex-col items-center lg:order-1 lg:col-start-1 lg:row-start-1 lg:row-span-2">
              <div
                className="relative w-full"
                style={{ maxWidth: format === "pfp" ? 520 : 460 }}
              >
                <canvas
                  ref={canvasRef}
                  width={spec.width}
                  height={spec.height}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="product-shadow block h-auto w-full touch-none select-none"
                  style={{
                    borderRadius: format === "pfp" ? "50%" : 18,
                    cursor: bitmap ? "grab" : "default",
                  }}
                  aria-label={`${spec.label} preview`}
                />
                {busy && (
                  <div className="absolute inset-0 grid place-items-center rounded-[inherit] bg-white/70">
                    <span className="t-caption text-ink-muted-80">
                      Reading photo…
                    </span>
                  </div>
                )}
              </div>

              {bitmap && (
                <p className="t-fine mt-4 text-center">
                  {autoFramed
                    ? "Framed on your face automatically — drag to adjust."
                    : "Drag the image to reposition."}
                </p>
              )}
            </div>

            {/* Controls ------------------------------------------------ */}
            <div className="order-3 flex flex-col gap-6 lg:col-start-2 lg:row-start-2">
              {bitmap && (
                <div>
                  <label
                    htmlFor="zoom"
                    className="t-eyebrow mb-3 flex items-center justify-between"
                  >
                    <span>Zoom</span>
                    <span className="tabular-nums">
                      {Math.round(transform.scale * 100)}%
                    </span>
                  </label>
                  <input
                    id="zoom"
                    type="range"
                    className="slider"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step={0.01}
                    value={transform.scale}
                    onChange={(e) => onScaleChange(Number(e.target.value))}
                  />
                </div>
              )}

              {format === "card" && (
                <DetailFields
                  details={details}
                  title={title}
                  onChange={setDetails}
                  onReroll={() => setTitleSalt((s) => s + 1)}
                />
              )}

              <ShareBar
                disabled={!bitmap}
                format={format}
                details={{ ...details, title }}
                blob={exported}
                getBlob={ensureBlob}
                getOgBlob={buildOgBlob}
                onDownload={handleDownload}
                onError={setError}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------------ */

function DetailFields({
  details,
  title,
  onChange,
  onReroll,
}: {
  details: Details;
  title: string;
  onChange: (d: Details) => void;
  onReroll: () => void;
}) {
  const set = (key: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...details, [key]: e.target.value });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="t-eyebrow mb-2 block">
          Name
        </label>
        <input
          id="name"
          className="field"
          value={details.name}
          onChange={set("name")}
          placeholder="Sanket Marathe"
          autoComplete="name"
          maxLength={40}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="role" className="t-eyebrow mb-2 block">
            Role
          </label>
          <input
            id="role"
            className="field"
            value={details.role}
            onChange={set("role")}
            placeholder="Backend"
            maxLength={28}
          />
        </div>
        <div>
          <label htmlFor="stack" className="t-eyebrow mb-2 block">
            Stack
          </label>
          <input
            id="stack"
            className="field"
            value={details.stack}
            onChange={set("stack")}
            placeholder="Rust · Postgres"
            maxLength={28}
          />
        </div>
      </div>

      <div>
        <label htmlFor="handle" className="t-eyebrow mb-2 block">
          X handle
        </label>
        <input
          id="handle"
          className="field"
          value={details.handle}
          onChange={set("handle")}
          placeholder="@yourhandle"
          maxLength={20}
        />
      </div>

      <div>
        <span className="t-eyebrow mb-2 block">Builder title</span>
        <div className="flex items-center gap-3">
          <p className="t-body-strong flex-1">{title}</p>
          <button type="button" className="btn btn-quiet" onClick={onReroll}>
            Reroll
          </button>
        </div>
      </div>
    </div>
  );
}
