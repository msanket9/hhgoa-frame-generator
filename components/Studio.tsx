"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PHOTO_WINDOW, autoFrame, warmDetector } from "@/lib/autoframe";
import {
  DecodeError,
  decodeImage,
  looksLikeImage,
  rotateBitmap,
} from "@/lib/decode";
import { canvasToBlob, downloadBlob, fileNameFor } from "@/lib/export";
import { IDENTITY_MATRIX } from "@/lib/render/colormatrix";
import { gradeBitmap } from "@/lib/render/grade";
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
import { LOOKS, LOOK_ORDER, type LookId } from "@/lib/render/looks";
import {
  THEMES,
  THEME_LABELS,
  THEME_SWATCH,
  type ThemeId,
} from "@/lib/render/themes";
import type { CardSide } from "@/lib/render/types";
import { titleFor } from "@/lib/titles";

import FormatToggle from "./FormatToggle";
import ShareBar from "./ShareBar";
import { EnvelopeIcon } from "./illustrations";

const EMPTY_DETAILS: Details = {
  name: "",
  role: "",
  stack: "",
  handle: "",
  title: "",
  shareUrl: "",
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

  /**
   * The share id is allocated up front, not after upload, because the QR is
   * baked into the image — the URL it encodes has to exist before the pixels
   * are drawn.
   *
   * It stays fixed for the session, so re-sharing after a tweak overwrites the
   * same page rather than orphaning the QR in an already-downloaded PNG. That
   * does mean a guessed id could be overwritten; with a 10-char nanoid that is
   * not a realistic threat here, and blocking legitimate re-shares would be a
   * far worse failure.
   */
  const [share] = useState(() => {
    const id = nanoid(10);
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return { id, url: origin ? `${origin}/s/${id}` : "" };
  });

  const [theme, setTheme] = useState<ThemeId>("sunset");
  const [look, setLook] = useState<LookId>("as-shot");
  const [side, setSide] = useState<CardSide>("front");

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoFramed, setAutoFramed] = useState(false);
  const [dragging, setDragging] = useState(false);
  /**
   * Whether the canvas owns touch gestures.
   *
   * It used to always own them (touch-action: none) so drag-to-pan worked —
   * which meant a finger landing anywhere on the artifact, i.e. most of a phone
   * screen, silently killed page scrolling. People reasonably concluded the
   * page was broken. Now the canvas scrolls like any other element until the
   * user explicitly asks to adjust.
   */
  const [adjusting, setAdjusting] = useState(false);
  const [exported, setExported] = useState<Blob | null>(null);

  // Guards handleFile/handleRotate against being stomped by a stale, still-
  // resolving call from before it. Without it, selecting two photos in quick
  // succession (or double-tapping Rotate) can let an earlier decode finish
  // last and overwrite — or worse, .close() — the bitmap the newer call just
  // committed.
  const opId = useRef(0);

  const warmed = useRef(false);
  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    warmDetector();
  }, []);

  // ImageBitmap holds decoded pixel data outside the JS heap (GPU/CPU-backed);
  // it's only ever freed by our own .close() calls elsewhere, none of which
  // fire on unmount. A ref mirrors the latest bitmap so this effect's cleanup
  // can release whatever's current without depending on `bitmap` itself and
  // re-subscribing on every photo change. The mirroring happens in its own
  // effect, not inline during render — mutating a ref while rendering is
  // unsafe under React 19's concurrent rendering (a render can be thrown away
  // or run twice) and the lint rule for it is not optional.
  const bitmapRef = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    bitmapRef.current = bitmap;
  }, [bitmap]);
  useEffect(() => {
    return () => bitmapRef.current?.close();
  }, []);

  const title = useMemo(
    () => details.title || titleFor(details.name, titleSalt),
    [details.title, details.name, titleSalt],
  );

  /**
   * Colour-graded copy of `bitmap` for the current look, computed once per
   * (photo, look) pair and reused for every subsequent draw.
   *
   * This exists instead of drawing with `ctx.filter` because that API is
   * unimplemented in WebKit on every platform (see colormatrix.ts) — every
   * iPhone browser is WebKit underneath, so `ctx.filter` silently no-ops
   * there. Grading ahead of time and caching the result also means the
   * per-frame drag/zoom path stays a plain, fast `drawImage` regardless.
   *
   * All paths — including the cache-hit fast path — resolve through the
   * nested async function rather than calling setState as a top-level
   * statement of the effect body: React's hooks lint (correctly) flags the
   * latter as "this should be a value computed during render," and reading
   * the cache ref during render isn't allowed either. Routing everything
   * through one async function matches the pattern React's own docs use for
   * effects that fetch/derive external data.
   */
  const [gradedBitmap, setGradedBitmap] = useState<ImageBitmap | null>(null);
  const gradeCache = useRef<Map<LookId, ImageBitmap>>(new Map());

  // A new source photo invalidates every previously graded variant of the
  // old one.
  useEffect(() => {
    const cache = gradeCache.current;
    return () => {
      for (const b of cache.values()) b.close();
      cache.clear();
    };
  }, [bitmap]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!bitmap) {
        setGradedBitmap(null);
        return;
      }
      const matrix = LOOKS[look].matrix;
      if (matrix === IDENTITY_MATRIX) {
        setGradedBitmap(null); // "as shot" — draw the source bitmap directly
        return;
      }

      const cached = gradeCache.current.get(look);
      const graded = cached ?? (await gradeBitmap(bitmap, matrix));

      if (cancelled) {
        // Only close a bitmap we just made — a cache hit is owned by the
        // cache and may still be in use elsewhere.
        if (!cached) graded.close();
        return;
      }
      if (!cached) gradeCache.current.set(look, graded);
      setGradedBitmap(graded);
    })();

    return () => {
      cancelled = true;
    };
  }, [bitmap, look]);

  const renderState: RenderState = useMemo(
    () => ({
      // Falls back to the raw bitmap while a non-identity grade is still
      // computing, so there's no blank flash on the first frame after
      // switching looks.
      bitmap: gradedBitmap ?? bitmap,
      transform,
      details: { ...details, title, shareUrl: share.url },
      theme,
      look,
      // The profile frame has no reverse; only the ID card flips.
      side: format === "card" ? side : "front",
    }),
    [
      gradedBitmap,
      bitmap,
      transform,
      details,
      title,
      share.url,
      theme,
      look,
      side,
      format,
    ],
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

      // Claimed before the first await, so a second call (double-drop, or
      // picking again before this one finishes) invalidates this one instead
      // of racing it — see the `opId` comment above.
      const myOp = ++opId.current;

      // HEIC on a non-Safari browser pays a one-off wasm decode, which is the
      // only path slow enough to need naming — say what's happening rather
      // than showing a generic spinner.
      const heic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
      setStatus(heic ? "Converting photo…" : "Reading photo…");
      setError(null);
      setAutoFramed(false);

      try {
        const decoded = await decodeImage(file);

        if (myOp !== opId.current) {
          // A newer upload already won; this one lost the race. Free the
          // bitmap we just decoded rather than leaking it, and touch nothing
          // else — the newer call owns state now.
          decoded.bitmap.close();
          return;
        }

        // Show the centre crop immediately; auto-framing refines it a beat
        // later. Waiting on the detector here would make upload feel slow.
        setBitmap((prev) => {
          prev?.close();
          return decoded.bitmap;
        });
        setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setAdjusting(false);
        setStatus(null);

        const win = PHOTO_WINDOW[format];
        const result = await autoFrame(decoded.bitmap, win.w, win.h);
        if (myOp !== opId.current) return;
        if (result.foundFace) {
          setTransform(
            clampTransform(decoded.bitmap, result.transform, win.w, win.h),
          );
          setAutoFramed(true);
        }
      } catch (err) {
        if (myOp !== opId.current) return;
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

  /** Re-solve auto-framing for the current photo and format. */
  const reframe = useCallback(
    async (source: ImageBitmap) => {
      const win = PHOTO_WINDOW[format];
      const result = await autoFrame(source, win.w, win.h);
      if (result.foundFace) {
        setTransform(clampTransform(source, result.transform, win.w, win.h));
        setAutoFramed(true);
      } else {
        setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
        setAutoFramed(false);
      }
    },
    [format],
  );

  const handleRotate = useCallback(async () => {
    if (!bitmap) return;
    const myOp = ++opId.current;
    setStatus("Rotating…");
    const rotated = await rotateBitmap(bitmap, 1);

    if (myOp !== opId.current) {
      // Superseded — e.g. a second Rotate tap landed, or a new photo was
      // dropped, before this turn finished. Without this check, two rapid
      // taps both read the same pre-rotation `bitmap` from their closures and
      // each apply a single 90° turn to it — the second tap's result silently
      // overwrites the first's instead of compounding, so two taps produce a
      // 90° result instead of 180°.
      rotated.close();
      return;
    }

    setBitmap((prev) => {
      if (prev && prev !== rotated) prev.close();
      return rotated;
    });
    setStatus(null);
    // Re-detect after turning: a face that was sideways is often only
    // detectable once the photo is the right way up.
    await reframe(rotated);
  }, [bitmap, reframe]);

  const handleReset = useCallback(() => {
    if (!bitmap) return;
    void reframe(bitmap);
  }, [bitmap, reframe]);

  const openPicker = () => {
    warm();
    inputRef.current?.click();
  };

  /* ------------------------------------------------------------ drag / pan */

  /**
   * Pointer handling covers one- and two-finger gestures from the same map.
   *
   * A slider alone is a poor fit for a phone — pinching is what people reach
   * for, and the brief puts most traffic on mobile. Wheel-zoom is the desktop
   * equivalent.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    origin: Transform;
    startX: number;
    startY: number;
    startDist: number;
    rect: DOMRect;
    moved: boolean;
  } | null>(null);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const beginGesture = (canvas: HTMLCanvasElement) => {
    const pts = [...pointers.current.values()];
    if (!pts.length) return;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    gesture.current = {
      origin: transform,
      startX: cx,
      startY: cy,
      startDist: pts.length >= 2 ? dist(pts[0], pts[1]) : 0,
      rect: canvas.getBoundingClientRect(),
      moved: false,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bitmap) return;
    // A mouse has no scroll ambiguity — the wheel scrolls, the button drags —
    // so pointer drags stay live there. Touch has to be asked for.
    if (e.pointerType === "touch" && !adjusting) return;
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture(canvas);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bitmap || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gesture.current;
    if (!g) return;

    const pts = [...pointers.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;

    const dx = (cx - g.startX) / g.rect.width;
    const dy = (cy - g.startY) / g.rect.height;
    if (Math.abs(dx) > 0.004 || Math.abs(dy) > 0.004) g.moved = true;

    let scale = g.origin.scale;
    if (pts.length >= 2 && g.startDist > 0) {
      const ratio = dist(pts[0], pts[1]) / g.startDist;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, g.origin.scale * ratio));
      g.moved = true;
    }

    const win = PHOTO_WINDOW[format];
    setTransform(
      clampTransform(
        bitmap,
        {
          scale,
          offsetX: g.origin.offsetX + dx,
          offsetY: g.origin.offsetY + dy,
        },
        win.w,
        win.h,
      ),
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      // Keep `moved` readable by the click handler that fires next.
      setTimeout(() => {
        gesture.current = null;
      }, 0);
    } else {
      // Lifting one finger of a pinch re-bases the gesture instead of jumping.
      beginGesture(e.currentTarget);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Without this the wheel zoomed AND scrolled the page at the same time.
    if (!bitmap || !adjusting) return;
    e.preventDefault();
    const win = PHOTO_WINDOW[format];
    const next = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, transform.scale * (1 - e.deltaY * 0.0015)),
    );
    setTransform((t) => clampTransform(bitmap, { ...t, scale: next }, win.w, win.h));
  };

  const onCanvasClick = () => {
    // The frame is the biggest thing on screen and reads as the button, so it
    // opens the picker when empty. After a photo is in, a tap that didn't pan
    // or pinch still means "change photo".
    if (adjusting) return;
    if (!bitmap || !gesture.current?.moved) openPicker();
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

    // Render the front into a scratch canvas for the share image — the card
    // may currently be flipped, and nobody wants a QR as their link preview.
    const front = document.createElement("canvas");
    await renderToAsync(front, format, { ...renderState, side: "front" });

    const og = document.createElement("canvas");
    og.width = 1200;
    og.height = 630;
    const ctx = og.getContext("2d");
    if (!ctx) return null;
    renderOg(ctx, front, { ...details, title, shareUrl: share.url });

    try {
      const [image, ogBlob] = await Promise.all([
        canvasToBlob(front, "image/jpeg", 0.9),
        canvasToBlob(og, "image/jpeg", 0.9),
      ]);
      return { image, og: ogBlob };
    } catch {
      return null;
    }
  }, [details, title, share.url, format, renderState]);

  const spec = FORMATS[format];

  return (
    <div className="flex w-full flex-col items-center">
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

      {/* The page's own hero already carries the headline; Studio starts
          straight at the tool so there's no duplicate title stacked here. */}
      <FormatToggle value={format} onChange={setFormat} />

      {/* The exhibit ---------------------------------------------------- */}
      <div
        className="anim-pop relative mt-9 w-full"
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
          onWheel={onWheel}
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
          className="exhibit block h-auto w-full select-none transition-transform duration-200"
          style={{
            borderRadius: format === "pfp" ? "50%" : 20,
            cursor: bitmap ? (adjusting ? "grab" : "pointer") : "pointer",
            transform: dragging ? "scale(1.02)" : undefined,
            // pan-y, not none: the page must still scroll under a finger.
            touchAction: adjusting ? "none" : "pan-y",
            outline: adjusting ? "2px solid var(--accent)" : undefined,
            outlineOffset: adjusting ? "6px" : undefined,
          }}
        />

        {format === "card" && (
          <button
            type="button"
            onClick={() => setSide((v) => (v === "front" ? "back" : "front"))}
            className="btn btn-bare absolute -bottom-11 left-1/2 -translate-x-1/2"
          >
            {side === "front" ? "Show the back →" : "← Show the front"}
          </button>
        )}

        {status && (
          <div
            className="absolute inset-0 grid place-items-center rounded-[inherit]"
            style={{ background: "rgba(247,241,224,0.88)" }}
          >
            <span className="t-caption t-mono font-semibold" style={{ color: "var(--green)" }}>
              {status}
            </span>
          </div>
        )}
      </div>

      {/* Wall text / actions -------------------------------------------- */}
      {!bitmap ? (
        <div className="anim-rise delay-1 mt-10 flex flex-col items-center gap-3">
          <button type="button" className="btn btn-stamp" onClick={openPicker}>
            <EnvelopeIcon /> Add your photo
          </button>
          <p className="t-fine">or drop one in — JPG, PNG, HEIC, WebP</p>
        </div>
      ) : (
        <div
          className={`card anim-rise flex w-full flex-col items-center px-5 py-6 sm:px-7 ${
            format === "card" ? "mt-16" : "mt-10"
          }`}
          style={{ maxWidth: 380 }}
        >
          {/* Framing */}
          <div className="w-full">
            <div className="t-eyebrow flex items-center justify-between">
              <span>{autoFramed ? "Framed on your face" : "Position"}</span>
              <span className="tabular-nums">
                {Math.round(transform.scale * 100)}%
              </span>
            </div>
            <input
              id="zoom"
              type="range"
              aria-label="Zoom"
              className="slider"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={transform.scale}
              onChange={(e) => onScaleChange(Number(e.target.value))}
            />
            <div className="-mt-1 flex items-center justify-between">
              <button
                type="button"
                className="btn btn-bare"
                onClick={() => setAdjusting((v) => !v)}
                style={adjusting ? { color: "var(--accent)" } : undefined}
              >
                {adjusting ? "Done" : "Adjust"}
              </button>
              <div className="flex">
                <button
                  type="button"
                  className="btn btn-bare"
                  onClick={handleRotate}
                  disabled={status !== null}
                >
                  Rotate
                </button>
                <button
                  type="button"
                  className="btn btn-bare"
                  onClick={handleReset}
                  disabled={status !== null}
                >
                  Recentre
                </button>
              </div>
            </div>

            {adjusting && (
              <p className="t-fine mt-1" style={{ color: "var(--accent)" }}>
                Drag to reposition · pinch or scroll to zoom · tap Done when
                finished
              </p>
            )}
          </div>

          {/* Theme — colour is the label, so no boxes and no words */}
          <div className="mt-9 flex w-full items-center justify-between">
            <span className="t-eyebrow">Theme</span>
            <div className="flex gap-3">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="swatch"
                  aria-pressed={theme === id}
                  aria-label={THEME_LABELS[id]}
                  title={THEME_LABELS[id]}
                  onClick={() => setTheme(id)}
                  style={{ background: THEME_SWATCH[id] }}
                />
              ))}
            </div>
          </div>

          {/* Look — contrast marks the selection */}
          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <span className="t-eyebrow sm:pt-2">Look</span>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              {LOOK_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  aria-pressed={look === id}
                  onClick={() => setLook(id)}
                >
                  {LOOKS[id].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 w-full">
            <DetailFields
              format={format}
              details={details}
              title={title}
              onChange={setDetails}
              onReroll={() => setTitleSalt((s) => s + 1)}
            />
          </div>

          <div className="mt-10 w-full">
            <ShareBar
              format={format}
              details={{ ...details, title, shareUrl: share.url }}
              shareId={share.id}
              blob={exported}
              getBlob={ensureBlob}
              getShareBlobs={buildShareBlobs}
              onDownload={handleDownload}
              onError={setError}
            />
          </div>

          <button
            type="button"
            onClick={openPicker}
            className="btn btn-bare mt-4"
          >
            Use a different photo
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="t-caption mt-6 w-full max-w-[380px] rounded-[12px] border-[1.5px] px-4 py-3 text-center font-semibold"
          style={{
            background: "#fff0f4",
            borderColor: "var(--pink)",
            color: "#c2185b",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function DetailFields({
  format,
  details,
  title,
  onChange,
  onReroll,
}: {
  format: FormatId;
  details: Details;
  title: string;
  onChange: (d: Details) => void;
  onReroll: () => void;
}) {
  const set = (key: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...details, [key]: e.target.value });

  const isCard = format === "card";

  return (
    <div className="flex flex-col gap-3">
      {/* Shown for both formats. The profile frame doesn't print a name, but
          the share link's card and landing page do — without this, every
          shared avatar reads as an anonymous "A builder". */}
      <input
        className="field"
        value={details.name}
        onChange={set("name")}
        placeholder={isCard ? "Your name" : "Your name (for the share card)"}
        aria-label="Your name"
        autoComplete="name"
        maxLength={40}
      />

      {isCard && (
        <>
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
        </>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="min-w-0">
          <span className="t-eyebrow block">Builder title</span>
          <p className="truncate text-[0.94rem] font-semibold">{title}</p>
        </div>
        <button type="button" className="btn btn-bare shrink-0" onClick={onReroll}>
          Reroll
        </button>
      </div>
    </div>
  );
}
