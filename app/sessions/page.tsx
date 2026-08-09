"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import Navbar from "../components/navbar";
import type { Session } from "../lib/db";
import {
    deleteSession,
    getAllSessions,
    getDepartments,
    getSessionCounts,
    type SessionCounts,
} from "../lib/queries";

interface SessionRow extends SessionCounts {
    session: Session;
    departmentID: number;
}

interface DepartmentGroup {
    departmentID: number;
    departmentName: string;
    rows: SessionRow[];
}

// A session's "sort/display time" is when it was last finished, falling
// back to when it was started for sessions still in progress — this is what
// lets a session started a week ago but finished just now show up as recent.
const sessionTime = (session: Session) => (session.finishedAt ?? session.date).getTime();

export default function SessionsHistoryPage() {
    const router = useRouter();
    const [groups, setGroups] = useState<DepartmentGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const loadRows = async () => {
        setLoading(true);
        const [sessions, departments] = await Promise.all([getAllSessions(), getDepartments()]);

        const deptByID = new Map(departments.map((d) => [d.departmentID, d]));

        const withCounts: SessionRow[] = await Promise.all(
            sessions.map(async (session) => ({
                session,
                departmentID: session.departmentID,
                ...(await getSessionCounts(session)),
            })),
        );

        const grouped = new Map<number, DepartmentGroup>();
        for (const row of withCounts) {
            const dept = deptByID.get(row.departmentID);
            const departmentName = dept ? dept.name + (dept.group ? ` - ${dept.group}` : "") : "Unknown course";

            if (!grouped.has(row.departmentID)) {
                grouped.set(row.departmentID, { departmentID: row.departmentID, departmentName, rows: [] });
            }
            grouped.get(row.departmentID)!.rows.push(row);
        }

        // Newest-finished (or newest-started, if still in progress) first within each group
        for (const g of grouped.values()) {
            g.rows.sort((a, b) => sessionTime(b.session) - sessionTime(a.session));
        }

        const groupList = Array.from(grouped.values()).sort((a, b) =>
            a.departmentName.localeCompare(b.departmentName),
        );

        setGroups(groupList);
        // Expand every group by default
        setExpanded(new Set(groupList.map((g) => g.departmentID)));
        setLoading(false);
    };

    useEffect(() => {
        loadRows();
    }, []);

    const toggleGroup = (departmentID: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(departmentID)) next.delete(departmentID);
            else next.add(departmentID);
            return next;
        });
    };

    const handleDelete = async (e: MouseEvent, sessionID: number) => {
        e.stopPropagation(); // don't trigger the row's own navigate-to-summary click
        if (!confirm("Delete this session and its attendance records? This can't be undone.")) return;
        await deleteSession(sessionID);
        setGroups((prev) =>
            prev
                .map((g) => ({ ...g, rows: g.rows.filter((r) => r.session.sessionID !== sessionID) }))
                .filter((g) => g.rows.length > 0),
        );
    };

    const formatDateTime = (d: Date) =>
        `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${d.toLocaleTimeString(
            "en-GB",
            { hour: "2-digit", minute: "2-digit" },
        )}`;

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title="Session History" />

            <div className="mx-auto w-full max-w-3xl flex-1 p-6 sm:p-8">
                {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

                {!loading && groups.length === 0 && (
                    <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
                )}

                <div className="flex flex-col gap-4">
                    {groups.map((group) => {
                        const isOpen = expanded.has(group.departmentID);
                        return (
                            <div
                                key={group.departmentID}
                                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.departmentID)}
                                    className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-accent"
                                >
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold text-card-foreground">
                                            {group.departmentName}
                                        </h2>
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                            {group.rows.length} {group.rows.length === 1 ? "session" : "sessions"}
                                        </span>
                                    </div>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""
                                            }`}
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>

                                {isOpen && (
                                    <div className="flex flex-col gap-3 border-t border-border p-4 sm:p-6">
                                        {group.rows.map(({ session, present, absent, unmarked }) => (
                                            <div
                                                key={session.sessionID}
                                                onClick={() => router.push(`/summary/${session.sessionID}`)}
                                                className="flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-background p-4 transition hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm text-muted-foreground">
                                                            {session.finished
                                                                ? `Finished ${formatDateTime(session.finishedAt ?? session.date)}`
                                                                : `Started ${formatDateTime(session.date)}`}
                                                        </p>
                                                        {!session.finished && (
                                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                                in progress
                                                            </span>
                                                        )}
                                                    </div>
                                                    {session.remarks && (
                                                        <p className="mt-2 line-clamp-2 text-sm italic text-muted-foreground">
                                                            "{session.remarks}"
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between gap-3 sm:justify-end">
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-600">
                                                            {present} present
                                                        </span>
                                                        <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
                                                            {absent} absent
                                                        </span>
                                                        {unmarked > 0 && (
                                                            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                                                                {unmarked} unmarked
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(e, session.sessionID)}
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                                        aria-label="Delete session"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}