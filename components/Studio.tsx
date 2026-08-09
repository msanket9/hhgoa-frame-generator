"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const [format, setFormat] = useState<FormatId>("pfp");
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [titleSalt, setTitleSalt] = useState(0);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoFramed, setAutoFramed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exported, setExported] = useState<Blob | null>(null);

  const warmed = useRef(false);
  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    warmDetector();
  }, []);

  const title = useMemo(
    () => details.title || titleFor(details.name, titleSalt),
    [details.title, details.name, titleSalt],
  );

  const renderState: RenderState = useMemo(
    () => ({ bitmap, transform, details: { ...details, title } }),
    [bitmap, transform, details, title],
  );

  /* ---------------------------------------------------------------- render */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    void (async () => {
      await renderToAsync(canvas, format, renderState);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [format, renderState]);

  /**
   * PNG export, debounced and separate from rendering.
   *
   * This used to run inside the render effect, which meant re-encoding a
   * ~1.4MB PNG on every pointermove while dragging the photo. Rendering is
   * sub-20ms; the encode was the expensive part, and it was firing dozens of
   * times a second for no reason.
   *
   * It still runs ahead of time rather than on click, because navigator.share()
   * has to be called synchronously inside the user gesture — Safari drops
   * activation across an await, so the bytes must already exist.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    let cancelled = false;

    setExported(null);
    const timer = setTimeout(() => {
      void canvasToBlob(canvas)
        .then((blob) => {
          if (!cancelled) setExported(blob);
        })
        .catch(() => {
          /* retried on demand */
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [format, renderState, bitmap]);

  /* ---------------------------------------------------------------- upload */

  const handleFile = useCallback(
    async (file: File) => {
      if (!looksLikeImage(file)) {
        setError("That doesn't look like an image file.");
        return;
      }

      // HEIC on a non-Safari browser pays a one-off wasm decode, which is the
      // only path slow enough to need naming — say what's happening rather
      // than showing a generic spinner.
      const heic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
      setStatus(heic ? "Converting photo…" : "Reading photo…");
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
        setStatus(null);

        const win = PHOTO_WINDOW[format];
        const result = await autoFrame(decoded.bitmap, win.w, win.h);
        if (result.foundFace) {
          setTransform(
            clampTransform(decoded.bitmap, result.transform, win.w, win.h),
          );
          setAutoFramed(true);
        }
      } catch (err) {
        setStatus(null);
        setError(
          err instanceof DecodeError
            ? err.message
            : "Something went wrong reading that photo.",
        );
      }
    },
    [format],
  );

  // Re-solve framing when switching formats — the photo window changes shape.
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

  const openPicker = () => {
    warm();
    inputRef.current?.click();
  };

  /* ------------------------------------------------------------ drag / pan */

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
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
      moved: false,
      origin: transform,
      rect: canvas.getBoundingClientRect(),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || !bitmap || drag.pointerId !== e.pointerId) return;

    const dx = (e.clientX - drag.startX) / drag.rect.width;
    const dy = (e.clientY - drag.startY) / drag.rect.height;
    if (Math.abs(dx) > 0.004 || Math.abs(dy) > 0.004) drag.moved = true;

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

  const onCanvasClick = () => {
    // The frame is the biggest thing on screen and reads as the button, so it
    // opens the picker when empty. Once a photo is in, a click that didn't
    // drag still means "change photo" — a tap on the image is never a pan.
    if (!bitmap || !dragRef.current?.moved) openPicker();
  };

  const onScaleChange = (scale: number) => {
    if (!bitmap) return;
    const win = PHOTO_WINDOW[format];
    setTransform((t) => clampTransform(bitmap, { ...t, scale }, win.w, win.h));
  };

  /* ---------------------------------------------------------------- output */

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

  /**
   * Images for the share link, as JPEG.
   *
   * The download stays PNG for quality, but the shared copies only ever get
   * viewed inside an X card — and a 1.4MB PNG upload put a multi-second stall
   * between tapping Share and X opening. JPEG at 0.9 is ~6x smaller with no
   * visible difference at card size.
   */
  const buildShareBlobs = useCallback(async (): Promise<{
    image: Blob;
    og: Blob;
  } | null> => {
    const source = canvasRef.current;
    if (!source) return null;

    const og = document.createElement("canvas");
    og.width = 1200;
    og.height = 630;
    const ctx = og.getContext("2d");
    if (!ctx) return null;
    renderOg(ctx, source, { ...details, title });

    try {
      const [image, ogBlob] = await Promise.all([
        canvasToBlob(source, "image/jpeg", 0.9),
        canvasToBlob(og, "image/jpeg", 0.9),
      ]);
      return { image, og: ogBlob };
    } catch {
      return null;
    }
  }, [details, title]);

  const spec = FORMATS[format];

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <input
        ref={inputRef}
        type="file"
        // HEIC listed explicitly: iOS reports an empty MIME type for it, and
        // without the extensions the picker greys those photos out.
        accept="image/*,.heic,.heif,.HEIC,.HEIF"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <FormatToggle value={format} onChange={setFormat} />

      {/* Preview — and, when empty, the primary upload target. */}
      <div
        className="relative w-full"
        style={{ maxWidth: format === "pfp" ? 420 : 372 }}
        onPointerEnter={warm}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
          warm();
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <canvas
          ref={canvasRef}
          width={spec.width}
          height={spec.height}
          onClick={onCanvasClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          aria-label={
            bitmap
              ? `${spec.label} preview. Drag to reposition, or activate to change photo.`
              : `${spec.label} preview. Activate to add your photo.`
          }
          className="product-shadow block h-auto w-full touch-none select-none transition-[transform,filter] duration-200"
          style={{
            borderRadius: format === "pfp" ? "50%" : 18,
            cursor: bitmap ? "grab" : "pointer",
            transform: dragging ? "scale(1.02)" : undefined,
            filter: dragging ? "brightness(1.06)" : undefined,
          }}
        />

        {status && (
          <div
            className="absolute inset-0 grid place-items-center rounded-[inherit] backdrop-blur-[2px]"
            style={{ background: "rgba(245,245,247,0.55)" }}
          >
            <span className="t-caption-strong">{status}</span>
          </div>
        )}
      </div>

      {/* One action at a time — nothing disabled is ever on screen. */}
      {!bitmap ? (
        <div className="flex flex-col items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={openPicker}>
            Add your photo
          </button>
          <p className="t-fine">or drop one in — JPG, PNG, HEIC, WebP</p>
        </div>
      ) : (
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <div>
            <label
              htmlFor="zoom"
              className="t-eyebrow mb-1 flex items-center justify-between"
            >
              <span>{autoFramed ? "Framed on your face" : "Position"}</span>
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
            <p className="t-fine -mt-1">Drag the image to reposition it.</p>
          </div>

          {format === "card" && (
            <DetailFields
              details={details}
              title={title}
              onChange={setDetails}
              onReroll={() => setTitleSalt((s) => s + 1)}
            />
          )}

          <ShareBar
            format={format}
            details={{ ...details, title }}
            blob={exported}
            getBlob={ensureBlob}
            getShareBlobs={buildShareBlobs}
            onDownload={handleDownload}
            onError={setError}
          />

          <button
            type="button"
            onClick={openPicker}
            className="t-caption mx-auto underline underline-offset-4"
            style={{ color: "var(--ink-muted-48)" }}
          >
            Use a different photo
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="t-caption w-full max-w-[420px] rounded-[11px] bg-[#fdeee9] px-4 py-3 text-center text-[#a03412]"
        >
          {error}
        </p>
      )}
    </div>
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
    <div className="flex flex-col gap-3">
      <input
        className="field"
        value={details.name}
        onChange={set("name")}
        placeholder="Your name"
        aria-label="Your name"
        autoComplete="name"
        maxLength={40}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          className="field"
          value={details.role}
          onChange={set("role")}
          placeholder="Role"
          aria-label="Role"
          maxLength={28}
        />
        <input
          className="field"
          value={details.stack}
          onChange={set("stack")}
          placeholder="Stack"
          aria-label="Stack"
          maxLength={28}
        />
      </div>
      <input
        className="field"
        value={details.handle}
        onChange={set("handle")}
        placeholder="@handle"
        aria-label="X handle"
        maxLength={20}
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <span className="t-eyebrow block">Builder title</span>
          <p className="t-body-strong truncate">{title}</p>
        </div>
        <button
          type="button"
          className="t-caption shrink-0 underline underline-offset-4"
          style={{ color: "var(--accent)" }}
          onClick={onReroll}
        >
          Reroll
        </button>
      </div>
    </div>
  );
}
