/**
 * Face-aware auto-framing.
 *
 * The brief says not to assume people crop before uploading, and the rest of
 * the field answers that with zoom/pan sliders — which is just handing the
 * work back. This centres the crop on the subject on upload instead.
 *
 * Strictly a progressive enhancement: the detector is ~3.3MB gzipped and can
 * fail or be unsupported, so every path falls back to a centre cover-crop and
 * nothing ever awaits it before showing a preview.
 */

import { MAX_SCALE, MIN_SCALE, type Transform } from "./render/types";

type Box = { x: number; y: number; w: number; h: number };

// Placement targets, tuned for how a face reads at avatar size: a little above
// centre, occupying enough of the frame to be recognisable at 48px.
const TARGET_FACE_FRACTION = 0.46;
const TARGET_CENTRE_Y = 0.46;

type Detector = {
  detect: (src: CanvasImageSource) => {
    detections: Array<{
      boundingBox?: {
        originX: number;
        originY: number;
        width: number;
        height: number;
      };
    }>;
  };
};

let detectorPromise: Promise<Detector | null> | null = null;

/**
 * Kicks off the wasm download without blocking anything.
 *
 * Called when the user first touches the dropzone, so the ~3.3MB transfer
 * overlaps the time they spend in the file picker — by the time a photo comes
 * back, the detector is usually already warm.
 */
export function warmDetector(): void {
  void getDetector();
}

function getDetector(): Promise<Detector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.4,
      });
      return detector as unknown as Detector;
    } catch {
      return null;
    }
  })();

  return detectorPromise;
}

/**
 * Largest detected face.
 *
 * Unioning every face sounds fairer but is wrong here: with two people at
 * opposite sides of a shot, the union's centre lands on the background between
 * them and a square crop clips both. Both outputs are about one person — an
 * avatar and an ID card — so the biggest face (nearest the camera, almost
 * always the subject) is the right default, and panning fixes the rest.
 */
function detectFaces(detector: Detector, source: HTMLCanvasElement): Box | null {
  const { detections } = detector.detect(source);
  if (!detections?.length) return null;

  let best: Box | null = null;
  for (const d of detections) {
    const b = d.boundingBox;
    if (!b) continue;
    const area = b.width * b.height;
    if (!best || area > best.w * best.h) {
      best = { x: b.originX, y: b.originY, w: b.width, h: b.height };
    }
  }
  return best;
}

/**
 * Converts a face box in bitmap pixels into our window-relative transform.
 *
 * The transform model is: cover-fit, then `scale` as a multiplier, with
 * offsets as a fraction of the window. Solving for the offsets that land the
 * face centre on the target point falls straight out of that mapping.
 */
function transformForFace(
  face: Box,
  imgW: number,
  imgH: number,
  winW: number,
  winH: number,
): Transform {
  const cover = Math.max(winW / imgW, winH / imgH);

  // BlazeFace boxes are tight to the face and exclude hair, so allow a bit
  // more headroom than the raw box implies.
  const faceExtent = Math.max(face.h * 1.25, face.w * 1.25);
  const rawScale = (Math.min(winW, winH) * TARGET_FACE_FRACTION) / (faceExtent * cover);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));

  const fx = face.x + face.w / 2;
  const fy = face.y + face.h / 2;

  const offsetX = (-(fx - imgW / 2) * cover * scale) / winW;
  const offsetY =
    TARGET_CENTRE_Y - 0.5 - ((fy - imgH / 2) * cover * scale) / winH;

  return { scale, offsetX, offsetY };
}

/** Downscaled copy — detection accuracy is unaffected and it keeps this fast. */
function toDetectionCanvas(bitmap: ImageBitmap): HTMLCanvasElement {
  const maxEdge = 512;
  const s = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * s));
  canvas.height = Math.max(1, Math.round(bitmap.height * s));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export type AutoFrameResult = {
  transform: Transform;
  /** False when we fell back to a centre crop, so the UI can stay quiet. */
  foundFace: boolean;
};

export async function autoFrame(
  bitmap: ImageBitmap,
  winW: number,
  winH: number,
): Promise<AutoFrameResult> {
  const fallback: AutoFrameResult = {
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    foundFace: false,
  };

  try {
    const detector = await getDetector();
    if (!detector) return fallback;

    const probe = toDetectionCanvas(bitmap);
    const face = detectFaces(detector, probe);
    if (!face) return fallback;

    // Detection ran on the downscaled copy; rescale the box back up.
    const ratio = bitmap.width / probe.width;
    const scaled: Box = {
      x: face.x * ratio,
      y: face.y * ratio,
      w: face.w * ratio,
      h: face.h * ratio,
    };

    return {
      transform: transformForFace(
        scaled,
        bitmap.width,
        bitmap.height,
        winW,
        winH,
      ),
      foundFace: true,
    };
  } catch {
    return fallback;
  }
}

/**
 * The photo window each format exposes, so auto-framing solves against the
 * shape the photo actually lands in rather than the full canvas.
 */
export const PHOTO_WINDOW = {
  pfp: { w: 896, h: 896 }, // inner circle diameter
  card: { w: 936, h: 780 },
} as const;

// Re-exported for the dev harness so it can report what was detected.
export type { Box as FaceBox };
