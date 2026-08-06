"use client";

import Link from "next/link";

interface NavbarProps {
    title: string;
    date?: string;
    onFinish?: () => void;
    backHref?: string;
}

export default function Navbar({ title, date, onFinish, backHref = "/" }: NavbarProps) {
    return (
        <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-sm">
            {/* Back Button */}
            <Link
                href={backHref}
                className="rounded-md p-2 transition hover:bg-accent hover:text-accent-foreground"
            >
                ←
            </Link>

            {/* Title / Date */}
            <div className="flex flex-col items-center">
                <h1 className="text-lg font-semibold text-card-foreground">{title}</h1>
                {date && <p className="text-sm text-muted-foreground">{date}</p>}
            </div>

            {/* Finish Button — only shown when a handler is passed in (i.e. during a session) */}
            {onFinish ? (
                <button
                    type="button"
                    onClick={onFinish}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                    Finish
                </button>
            ) : (
                <span className="w-[68px]" aria-hidden="true" />
            )}
        </nav>
    );
}