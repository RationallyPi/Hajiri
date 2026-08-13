"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Department } from "./lib/db";
import { getDepartments } from "./lib/queries";
import { ProfileProvider, ProfileDisplay, CustomizeButton } from "./components/profileHeader";
import ThemeToggle from "./components/themeToggle";

export default function Home() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDepartments().then((deps) => {
      setDepartments(deps);
      setLoading(false);
    });
  }, []);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied or unavailable — fail silently.
    }
  };

  return (
    <ProfileProvider>
      <main className="relative flex min-h-screen items-center justify-center bg-background px-6">
        {/* Edit Courses entry point */}
        <div className="absolute left-6 top-6 border-2 border-border rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground">
          <Link
            href="/courses"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Manage Courses
          </Link>
        </div>

        {/* Share + Customize + Settings + History entry points */}
        <div className="absolute right-6 top-6 flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              aria-label="Copy link to this page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
            {copied && (
              <span className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-primary shadow-sm">
                Copied to clipboard
              </span>
            )}
          </div>
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-md text-xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground" />
          <Link
            href="/sessions"
            className="flex h-9 w-9 items-center justify-center rounded-md text-xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Session history"
          >
            🕘
          </Link>
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-md text-xl text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Settings"
          >
            ⚙
          </Link>
        </div>

        <div className="flex w-full max-w-md flex-col items-center">
          <ProfileDisplay />
          <h1 className="mb-2 mt-3 text-4xl font-bold text-foreground">Hajiri</h1>
          <p className="mb-10 text-muted-foreground">Select a class to begin attendance</p>

          <div className="flex w-full flex-col gap-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

            {!loading && departments.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
                <span className="text-3xl" aria-hidden="true">
                  📚
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-card-foreground">No courses yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add a course to start taking attendance.
                  </p>
                </div>
                <Link
                  href="/courses"
                  className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Add your first course
                </Link>
              </div>
            )}

            {departments.map((d) => (
              <Link key={d.departmentID} href={`/session/${d.departmentID}`}>
                <div
                  className="
                    group
                    flex
                    w-full
                    overflow-hidden
                    rounded-lg
                    border
                    border-border
                    shadow-sm
                    transition-all
                    duration-200
                    hover:shadow-md
                    active:scale-[0.98]
                  "
                >
                  {/* Section / Group strip */}
                  <div className="flex w-20 shrink-0 items-center justify-center bg-primary/20 px-2 py-4 text-center">
                    <span className="text-sm font-semibold leading-tight text-primary">
                      {d.group || "—"}
                    </span>
                  </div>

                  {/* Class name */}
                  <div className="flex flex-1 items-center bg-card px-6 py-4 transition group-hover:bg-accent">
                    <span className=" text-lg font-semibold text-card-foreground transition group-hover:text-accent-foreground">
                      {d.name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </ProfileProvider>
  );
}