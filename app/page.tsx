"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Department } from "./lib/db";
import { getDepartments } from "./lib/queries";

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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6">
      {/* Settings + History entry points */}
      <div className="absolute right-6 top-6 flex gap-1">
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
        <h1 className="mb-2 text-4xl font-bold text-foreground">Hajiri</h1>
        <p className="mb-10 text-muted-foreground">Select a class to begin attendance</p>

        <div className="flex w-full flex-col gap-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && departments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No courses yet —{" "}
              <Link href="/settings" className="underline">
                add one in Settings
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
  );
}