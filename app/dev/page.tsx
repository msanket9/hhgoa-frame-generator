"use client";

/**
 * Dev-only harness. Runs the real decode -> auto-frame -> render pipeline over
 * the test photos and writes each result to .devsnaps/ so output can be
 * inspected as actual image files rather than squinting at a preview.
 */

import { useCallback, useRef, useState } from "react";

import { PHOTO_WINDOW, autoFrame } from "@/lib/autoframe";
import { decodeImage } from "@/lib/decode";
import { canvasToBlob } from "@/lib/export";
import { renderOg } from "@/lib/render/og";
import {
  type FormatId,
  FORMATS,
  clampTransform,
  renderToAsync,
} from "@/lib/render";
import { titleFor } from "@/lib/titles";

const PHOTOS = [
  "face1.jpg", // 1920x2880 portrait
  "face2.jpg",
  "face3.jpg",
  "face4.jpg",
  "offcentre.jpg", // 3600x1674, subject in the left third
  "group.jpg", // two faces — union framing
  "wide.jpg", // 2400x900 wide crop
  "small.jpg", // 120x180, below output resolution
  "landscape.jpg", // no face
  "tall.jpg", // no face, very tall
  "iphone.heic", // real HEIC
];

const NAMES: Record<string, string> = {
  "face1.jpg": "Ada Lovelace",
  "face2.jpg": "Grace Hopper",
  "face3.jpg": "Radia Perlman",
  "face4.jpg": "Karen Spärck Jones",
  "offcentre.jpg": "Off Centre",
  "group.jpg": "Two Builders",
  "wide.jpg": "Wide Crop",
  "small.jpg": "Tiny Upload",
  "landscape.jpg": "No Face Here",
  "tall.jpg": "Very Tall Photo",
  "iphone.heic": "Heic Fromiphone",
};

async function snap(canvas: HTMLCanvasElement, name: string) {
  const blob = await canvasToBlob(canvas);
  const fd = new FormData();
  fd.append("file", blob, name);
  fd.append("name", name);
  await fetch("/api/devsnap", { method: "POST", body: fd });
}

/** Guard rather than a route-level check — NODE_ENV is inlined at build time,
 *  so the harness body is dropped from the production bundle entirely. */
const ENABLED = process.env.NODE_ENV !== "production";

export default function DevPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState<string[]>([]);

  const run = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lines: string[] = [];

    for (const photo of PHOTOS) {
      const res = await fetch(`/testphotos/${photo}`);
      // Deliberately blank the MIME type on the HEIC to mirror what iOS file
      // inputs actually hand over — extension sniffing has to carry it.
      const isHeic = photo.endsWith(".heic");
      const file = new File([await res.blob()], photo, {
        type: isHeic ? "" : "image/jpeg",
      });

      const t0 = performance.now();
      const decoded = await decodeImage(file);
      const tDecode = performance.now() - t0;

      for (const format of ["pfp", "card"] as FormatId[]) {
        const win = PHOTO_WINDOW[format];
        const t1 = performance.now();
        const af = await autoFrame(decoded.bitmap, win.w, win.h);
        const tFrame = performance.now() - t1;

        const name = NAMES[photo] ?? "Builder";
        const state = {
          bitmap: decoded.bitmap,
          transform: clampTransform(
            decoded.bitmap,
            af.transform,
            win.w,
            win.h,
          ),
          details: {
            name,
            role: "Backend",
            stack: "Rust · Postgres",
            handle: "sanket",
            title: titleFor(name),
          },
        };

        const t2 = performance.now();
        await renderToAsync(canvas, format, state);
        const tRender = performance.now() - t2;

        await snap(canvas, `${format}-${photo.replace(/\.(jpg|heic)$/, "")}.png`);

        lines.push(
          `${photo} ${format}: decode ${tDecode.toFixed(0)}ms · autoframe ${tFrame.toFixed(0)}ms (${af.foundFace ? "FACE" : "none"}) · render ${tRender.toFixed(0)}ms · ${decoded.width}x${decoded.height} · scale ${state.transform.scale.toFixed(2)}`,
        );

        if (format === "pfp") {
          const og = document.createElement("canvas");
          og.width = 1200;
          og.height = 630;
          const ctx = og.getContext("2d");
          if (ctx) {
            renderOg(ctx, canvas, state.details);
            await snap(og, `og-${photo.replace(/\.(jpg|heic)$/, "")}.png`);
          }
        }
      }

      decoded.bitmap.close();
      setLog([...lines]);
    }

    // Empty states too.
    for (const format of ["pfp", "card"] as FormatId[]) {
      await renderToAsync(canvas, format, {
        bitmap: null,
        transform: { scale: 1, offsetX: 0, offsetY: 0 },
        details: {
          name: "",
          role: "",
          stack: "",
          handle: "",
          title: titleFor(""),
        },
      });
      await snap(canvas, `${format}-empty.png`);
    }

    // Static promo card for the site's own OG preview, rendered from the real
    // empty-state artwork so it can never drift from what the tool produces.
    await renderToAsync(canvas, "pfp", {
      bitmap: null,
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      details: { name: "", role: "", stack: "", handle: "", title: "" },
    });
    const promo = document.createElement("canvas");
    promo.width = 1200;
    promo.height = 630;
    const pctx = promo.getContext("2d");
    if (pctx) {
      const { renderPromo } = await import("@/lib/render/promo");
      renderPromo(pctx, canvas);
      await snap(promo, "promo-og.png");
    }

    lines.push("done");
    setLog([...lines]);
  }, []);

  if (!ENABLED) return null;

  return (
    <main className="p-8">
      <button className="btn btn-primary" onClick={run}>
        Run pipeline
      </button>
      <canvas
        ref={canvasRef}
        width={FORMATS.pfp.width}
        height={FORMATS.pfp.height}
        className="mt-6 w-[300px]"
      />
      <pre className="t-fine mt-6 whitespace-pre-wrap">{log.join("\n")}</pre>
    </main>
  );
}
