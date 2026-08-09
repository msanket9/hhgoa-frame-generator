/**
 * File -> ImageBitmap, handling the messy reality of photos people actually
 * upload: HEIC from iPhones, EXIF-rotated portraits, and 12MP originals.
 */

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/**
 * Cap on the long edge of the decoded bitmap.
 *
 * Output is 1080px, so 1600 leaves headroom to zoom in past 1:1 without the
 * source going soft, while keeping every subsequent draw cheap. Decoding a
 * 12MP original at full size makes drag-to-pan visibly stutter on phones.
 */
const MAX_EDGE = 1600;

const HEIC_EXT = /\.(heic|heif)$/i;
const SUPPORTED_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

export class DecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DecodeError";
  }
}

/**
 * iOS file inputs routinely hand back an empty `type`, and some Android
 * pickers report `application/octet-stream`, so the extension is often the
 * only signal we get. Check both.
 */
function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    HEIC_EXT.test(file.name)
  );
}

export function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || SUPPORTED_EXT.test(file.name);
}

/**
 * Safari can decode HEIC natively; every other browser cannot. Rather than
 * sniff the UA, just try the native path first and only pay for the ~1.5MB
 * libheif wasm when the native decode actually fails.
 */
async function toDecodableBlob(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return file;
  } catch {
    // Native decode unavailable — fall through to libheif.
  }

  try {
    const { heicTo } = await import("heic-to");
    return await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  } catch (err) {
    throw new DecodeError(
      "That HEIC photo couldn't be read. Try exporting it as JPEG first.",
      { cause: err },
    );
  }
}

export type DecodedImage = {
  bitmap: ImageBitmap;
  /** Dimensions of the decoded (possibly downscaled) bitmap. */
  width: number;
  height: number;
};

export async function decodeImage(file: File): Promise<DecodedImage> {
  if (!looksLikeImage(file)) {
    throw new DecodeError("That doesn't look like an image file.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DecodeError("That image is over 40MB. Try a smaller one.");
  }

  const blob = await toDecodableBlob(file);

  // `imageOrientation: 'from-image'` applies the EXIF rotation for us, which
  // is what stops portrait iPhone shots arriving sideways. Supported in all
  // current engines; the catch below covers anything that chokes on the flag.
  let probe: ImageBitmap;
  try {
    probe = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    try {
      probe = await createImageBitmap(blob);
    } catch (err) {
      throw new DecodeError("That image couldn't be opened.", { cause: err });
    }
  }

  const longEdge = Math.max(probe.width, probe.height);
  if (longEdge <= MAX_EDGE) {
    return { bitmap: probe, width: probe.width, height: probe.height };
  }

  // Downscale in one high-quality step rather than drawing large every frame.
  const scale = MAX_EDGE / longEdge;
  const width = Math.max(1, Math.round(probe.width * scale));
  const height = Math.max(1, Math.round(probe.height * scale));

  try {
    const resized = await createImageBitmap(probe, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    probe.close();
    return { bitmap: resized, width, height };
  } catch {
    // resize options unsupported — the full-size bitmap still works.
    return { bitmap: probe, width: probe.width, height: probe.height };
  }
}
