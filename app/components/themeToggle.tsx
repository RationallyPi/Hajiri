"use client";

import { useEffect, useState } from "react";

// Toggles the `.dark` class on <html> (the palette already exists in
// globals.css) and persists the choice so the layout's pre-paint script can
// restore it without a flash. Defaults to the OS preference on first run.
export default function ThemeToggle({ className }: { className?: string }) {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        // Sync state with the DOM class the layout set before first paint.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggle = () => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem("hajiri-theme", next ? "dark" : "light");
        } catch {
            // Storage unavailable (private mode) — theme still applies for the session.
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            className={className}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            role="switch"
            aria-checked={dark}
        >
            {dark ? "☀" : "☾"}
        </button>
    );
}
