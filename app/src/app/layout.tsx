import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PowderCast — Snow Forecasting for Ski Resorts",
  description:
    "Multi-model snow forecasts for 200+ North American ski resorts. Blended GFS, ECMWF, ICON, and GEM models with SNOTEL validation.",
  keywords: [
    "snow forecast",
    "ski resort",
    "powder day",
    "snowfall prediction",
    "SNOTEL",
    "ski weather",
  ],
  openGraph: {
    title: "PowderCast — Snow Forecasting",
    description:
      "Multi-model snow forecasts for North American ski resorts.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-border bg-bg-secondary/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold text-text-primary">
                PowderCast
              </span>
            </Link>

            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                Home
              </Link>
              <Link
                href="/map"
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                Map
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                About
              </Link>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-border bg-bg-secondary">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  PowderCast
                </span>
                <span className="text-xs text-text-secondary">
                  Multi-model snow forecasting
                </span>
              </div>
              <div className="text-xs text-text-secondary">
                Data from{" "}
                <a
                  href="https://open-meteo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  Open-Meteo
                </a>
                {" / "}
                <a
                  href="https://www.nrcs.usda.gov/wps/portal/wcc/home/snowClimateMonitoring/snowpack/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  SNOTEL
                </a>
                {" / "}
                <a
                  href="https://www.weather.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  NWS
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
