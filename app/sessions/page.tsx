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
    departmentName: string;
}

export default function SessionsHistoryPage() {
    const router = useRouter();
    const [rows, setRows] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRows = async () => {
        setLoading(true);
        const [sessions, departments] = await Promise.all([getAllSessions(), getDepartments()]);
        const deptNameByID = new Map(departments.map((d) => [d.departmentID, d.name]));

        const withCounts = await Promise.all(
            sessions.map(async (session) => ({
                session,
                departmentName: deptNameByID.get(session.departmentID) ?? "Unknown course",
                ...(await getSessionCounts(session)),
            })),
        );

        setRows(withCounts);
        setLoading(false);
    };

    useEffect(() => {
        loadRows();
    }, []);

    const handleDelete = async (e: MouseEvent, sessionID: number) => {
        e.stopPropagation(); // don't trigger the row's own navigate-to-summary click
        if (!confirm("Delete this session and its attendance records? This can't be undone.")) return;
        await deleteSession(sessionID);
        setRows((prev) => prev.filter((r) => r.session.sessionID !== sessionID));
    };

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title="Session History" />

            <div className="mx-auto w-full max-w-3xl flex-1 p-6 sm:p-8">
                {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

                {!loading && rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
                )}

                <div className="flex flex-col gap-4">
                    {rows.map(({ session, departmentName, present, absent, unmarked }) => (
                        <div
                            key={session.sessionID}
                            onClick={() => router.push(`/summary/${session.sessionID}`)}
                            className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-lg font-semibold text-card-foreground">{departmentName}</p>
                                    {!session.finished && (
                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                            in progress
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    {session.date.toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                    })}
                                    {" · "}
                                    {session.date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </p>
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
                                    aria-label={`Delete session for ${departmentName}`}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}