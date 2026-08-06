import Link from "next/link";

export default function Navbar() {
    return (
        <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-sm">
            {/* Back Button */}
            <Link
                href="/"
                className="rounded-md p-2 transition hover:bg-accent hover:text-accent-foreground"
            >
                ←
            </Link>

            {/* Session Info */}
            <div className="flex flex-col items-center">
                <h1 className="text-lg font-semibold text-card-foreground">
                    BSc Agriculture
                </h1>
                <p className="text-sm text-muted-foreground">
                    5 August 2026
                </p>
            </div>

            {/* Finish Button */}
            <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
                Finish
            </button>
        </nav>
    );
}