import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Instrument_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { UnitToggle } from "@/components/UnitToggle";
import MobileNav from "@/components/MobileNav";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#07111F",
};

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PowderCast",
  },
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
        className={`${bebasNeue.variable} ${instrumentSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-border bg-bg-secondary/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="group flex items-center gap-3">
              {/* Mountain logo */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-blue/10 ring-1 ring-accent-blue/25 transition-all group-hover:bg-accent-blue/15 group-hover:ring-accent-blue/50">
                <svg
                  className="h-5 w-5 text-accent-blue"
                  viewBox="0 0 28 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Mountain fill */}
                  <path
                    d="M1 22L9 5L14 13L18 7L27 22H1Z"
                    fill="currentColor"
                    fillOpacity="0.15"
                  />
                  {/* Mountain outline */}
                  <path
                    d="M1 22L9 5L14 13L18 7L27 22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  {/* Snow sparkle at summit */}
                  <path
                    d="M18 7V4M18 7L20.5 5M18 7L15.5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="font-brand text-xl tracking-widest text-text-primary transition-colors group-hover:text-accent-blue">
                POWDERCAST
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Forecasts
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
              <UnitToggle />
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 pb-16 sm:pb-0">{children}</main>
        <MobileNav />

        {/* Footer */}
        <footer className="border-t border-border bg-bg-secondary/50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <span className="font-brand text-sm tracking-widest text-text-primary">
                  POWDERCAST
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
                {" · "}
                <a
                  href="https://www.nrcs.usda.gov/wps/portal/wcc/home/snowClimateMonitoring/snowpack/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  SNOTEL
                </a>
                {" · "}
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
        </Providers>
      </body>
    </html>
  );
}
