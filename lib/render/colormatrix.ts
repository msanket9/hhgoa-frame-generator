/**
 * Color grading via explicit 4x5 affine color matrices — the same primitive
 * SVG's `feColorMatrix` and the CSS Filter Effects spec are built on.
 *
 * This exists because `CanvasRenderingContext2D.filter` — which is what the
 * "Photo look" feature originally used — is not implemented in WebKit at
 * all, on any platform. Per MDN's browser-compat-data, `safari` and
 * `safari_ios` both report `version_added: false`: not partial support, not
 * a version gap, never shipped. Since every iOS browser is WebKit under the
 * hood (Apple requires it), that silently no-ops the feature for every
 * iPhone user, not just Safari-branded ones.
 *
 * Each function below reproduces the exact reference matrix the CSS Filter
 * Effects Module defines for the equivalent `filter:` keyword, so switching
 * to this is a faithful port, not an approximation — verified against known
 * reference points (e.g. grayscale(1) on pure red yields the 0.2126 luma
 * coefficient) before this was wired into rendering.
 */

/** Row-major [R, G, B, A, offset] x4 — 20 numbers, values in 0–1 space. */
export type ColorMatrix = readonly [
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
];

export const IDENTITY_MATRIX: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Composes so that applying the result equals applying `a` then `b`. */
export function compose(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Array(20).fill(0) as number[];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += b[row * 5 + k] * a[k * 5 + col];
      out[row * 5 + col] = sum;
    }
    let offset = b[row * 5 + 4];
    for (let k = 0; k < 4; k++) offset += b[row * 5 + k] * a[k * 5 + 4];
    out[row * 5 + 4] = offset;
  }
  return out as unknown as ColorMatrix;
}

/** Chains filter steps left-to-right, matching CSS `filter:` list order. */
export function chain(...matrices: ColorMatrix[]): ColorMatrix {
  return matrices.reduce((acc, m) => compose(acc, m), IDENTITY_MATRIX);
}

export function grayscale(amount: number): ColorMatrix {
  const a = 1 - Math.min(1, amount);
  return [
    0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0, 0,
    0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0, 0,
    0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export function sepia(amount: number): ColorMatrix {
  const a = 1 - Math.min(1, amount);
  return [
    0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0,
    0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0,
    0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export function saturate(amount: number): ColorMatrix {
  const s = amount;
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export function hueRotate(degrees: number): ColorMatrix {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export function brightness(amount: number): ColorMatrix {
  return [
    amount, 0, 0, 0, 0,
    0, amount, 0, 0, 0,
    0, 0, amount, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export function contrast(amount: number): ColorMatrix {
  const off = 0.5 - 0.5 * amount;
  return [
    amount, 0, 0, 0, off,
    0, amount, 0, 0, off,
    0, 0, amount, 0, off,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Applies a matrix to an ImageData buffer in place.
 *
 * Coefficients are hoisted to locals and the loop stays branch-free and
 * closure-free on purpose — this runs over up to ~2.5M pixels (the
 * MAX_EDGE-bounded upload ceiling) on real phones, and V8/JSC's JIT does
 * measurably worse once a hot loop calls back out into a function per pixel.
 */
export function applyColorMatrix(data: Uint8ClampedArray, m: ColorMatrix): void {
  const [
    m00, m01, m02, , o0,
    m10, m11, m12, , o1,
    m20, m21, m22, , o2,
  ] = m;
  const O0 = o0 * 255;
  const O1 = o1 * 255;
  const O2 = o2 * 255;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = m00 * r + m01 * g + m02 * b + O0;
    data[i + 1] = m10 * r + m11 * g + m12 * b + O1;
    data[i + 2] = m20 * r + m21 * g + m22 * b + O2;
    // Alpha untouched — none of our looks alter it, and Uint8ClampedArray
    // clamping handles the RGB overflow from brightness/contrast for free.
  }
}
