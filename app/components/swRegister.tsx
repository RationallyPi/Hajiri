"use client";

import { useEffect } from "react";

// Registers the offline service worker (public/sw.js). Safe no-op on browsers
// without service worker support; `updateViaCache: "none"` keeps the SW itself
// from being served stale so a new version always activates.
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
                // Offline/first-run hiccup — the app still works, just not cached yet.
            });
        }
    }, []);

    return null;
}
