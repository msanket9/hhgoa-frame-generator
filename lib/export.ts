import type { FormatId } from "./render/types";

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas export failed")),
      type,
      quality,
    );
  });
}

export function fileNameFor(format: FormatId, name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "builder";
  const kind = format === "pfp" ? "pfp" : "id";
  return `hhgoa26-${kind}-${slug}.png`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next frame — revoking synchronously cancels the download
  // in some Safari builds.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
