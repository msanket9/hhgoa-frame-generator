import type { NextConfig } from "next";

/**
 * Baseline security headers. This app has no auth and no cookies of
 * consequence, so the goal here is standard hardening rather than protecting
 * a session — clickjacking, MIME-sniffing, and locking down what the page is
 * allowed to load or be loaded into.
 *
 * The CSP is pragmatic rather than maximal: `'unsafe-inline'` stays on
 * script-src and style-src because Next's App Router streams hydration data
 * through inline `<script>` tags and this app leans on inline `style={{}}`
 * throughout — removing either without a nonce-based setup (a bigger,
 * riskier change days before a deadline) would break rendering outright.
 * Every other directive is scoped tight.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // blob: for exported-image object URLs (download/copy), data: for the tiny
  // inline swatches; the wildcard covers the per-store Blob subdomain, which
  // isn't a fixed hostname.
  "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self'",
  // mediapipe's wasm runtime spins up a worker from a blob: URL.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Nothing on this page uses any of these; deny them explicitly.
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Vercel's edge already strips this on what we've deployed, but that's
  // platform behavior this config shouldn't depend on — set it here so it's
  // true regardless of where this ever gets hosted.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
