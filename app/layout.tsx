import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import ServiceWorkerRegister from "./components/swRegister";

// Self-hosted Geist (fonts shipped inside this repo via `next/font/local`) —
// no Google Fonts download at build time, so `next build` works fully offline
// and the browser never makes a network request for fonts.
const geistSans = localFont({
    src: "./fonts/Geist-Variable.woff2",
    variable: "--font-geist-sans",
    display: "swap",
});

const geistMono = localFont({
    src: "./fonts/GeistMono-Variable.woff2",
    variable: "--font-geist-mono",
    display: "swap",
});

export const viewport: Viewport = {
    themeColor: "#2e7d32",
};

export const metadata: Metadata = {
    title: "Hajiri",
    description: "Offline-first attendance tracking",
    applicationName: "Hajiri",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Hajiri",
    },
    formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <head>
                {/* Apply saved theme before first paint so there's no flash of the
                    wrong theme. Reads localStorage, falls back to the OS preference. */}
                <Script id="theme-init" strategy="beforeInteractive">
                    {`(function(){try{var t=localStorage.getItem("hajiri-theme");var dark=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark)document.documentElement.classList.add("dark");}catch(e){}})();`}
                </Script>
            </head>
            <body className="min-h-full flex flex-col">
                {children}
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
