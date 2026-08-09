import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// system-ui resolves to real SF Pro on Apple platforms, so Inter only ever
// loads as the substitute face on everything else.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
