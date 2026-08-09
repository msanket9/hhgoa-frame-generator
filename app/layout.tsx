import type { Metadata, Viewport } from "next";
import "./globals.css";

// No webfont for the UI. system-ui resolves to SF Pro on Apple platforms and
// Roboto / Segoe UI elsewhere — all fine at this weight range, and it saves
// every visitor a 48KB download for a face most of them never see.

/**
 * Vercel injects VERCEL_PROJECT_PRODUCTION_URL on every deploy, so absolute OG
 * URLs resolve correctly without anyone remembering to set a site URL by hand.
 */
function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Frame in Goa — Hacker House Goa 2026",
  description:
    "Drop a photo, get your Hacker House Goa 2026 frame. No login, no signup.",
  openGraph: {
    title: "Frame in Goa — Hacker House Goa 2026",
    description:
      "Drop a photo, get your Hacker House Goa 2026 frame. No login, no signup.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // The canvas supports drag-to-pan; letting the page zoom under the gesture
  // makes that feel broken on iOS.
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Grammarly and similar extensions stamp attributes onto <body> before
          React hydrates, which trips the mismatch warning. Suppressing it here
          keeps the console clean so a real mismatch is still visible. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
