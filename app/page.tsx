"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Department } from "./lib/db";
import { getDepartments } from "./lib/queries";
import { ProfileProvider, ProfileDisplay, CustomizeButton } from "./components/profileHeader";

export default function Home() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartments().then((deps) => {
      setDepartments(deps);
      setLoading(false);
    });
  }, []);

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

        {/* Customize + Settings + History entry points */}
        <div className="absolute right-6 top-6 flex gap-1">
          <CustomizeButton />
          <Link
            href="/sessions"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Session history"
          >
            🕘
          </Link>
          <Link
            href="/settings"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
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
              <p className="text-sm text-muted-foreground">
                No courses yet —{" "}
                <Link href="/courses" className="underline">
                  add one
                </Link>
                .
              </p>
            )}

            {departments.map((d) => (
              <Link key={d.departmentID} href={`/session/${d.departmentID}`}>
                <button
                  className="
                    w-full
                    rounded-lg
                    border
                    border-border
                    bg-card
                    px-6
                    py-4
                    text-left
                    text-lg
                    font-medium
                    text-card-foreground
                    shadow-sm
                    transition-all
                    duration-200
                    hover:bg-accent
                    hover:text-accent-foreground
                    hover:shadow-md
                    active:scale-[0.98]
                  "
                >
                  {d.name}
                  {d.group ? ` - ${d.group}` : ""}
                </button>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </ProfileProvider>
  );
}