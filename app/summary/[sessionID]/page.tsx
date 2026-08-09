"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar";
import { getSessionSummary, updateSessionRemarks, type SessionSummary } from "../../lib/queries";

export default function SessionSummaryPage({ params }: { params: Promise<{ sessionID: string }> }) {
    const { sessionID: sessionIDParam } = use(params);
    const sessionID = Number(sessionIDParam);

    const [summary, setSummary] = useState<SessionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        getSessionSummary(sessionID).then((s) => {
            setSummary(s);
            setRemarks(s?.session.remarks ?? "");
            setLoading(false);
        });
    }, [sessionID]);

    const saveRemarks = () => updateSessionRemarks(sessionID, remarks);

    if (loading) {
        return (
            <main className="flex min-h-screen flex-col bg-background">
                <Navbar title="Summary" />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</p>
            </main>
        );
    }

    if (!summary) {
        return (
            <main className="flex min-h-screen flex-col bg-background">
                <Navbar title="Summary" />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">
                    Session not found.
                </p>
            </main>
        );
    }

    const { session, department, entries, presentCount, absentCount, unmarkedCount } = summary;
    const absentees = entries.filter((e) => e.status === "absent");

    // Prefer the actual finish time — this is what makes a session started a
    // week ago but only finished today correctly show today's date/time here,
    // instead of the stale start date. Falls back to the start date for
    // sessions that are somehow shown here unfinished.
    const displayDate = session.finishedAt ?? session.date;
    const dateLabel = displayDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    const timeLabel = displayDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title={department.name} date={`${dateLabel} · ${timeLabel}`} />

            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 p-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-4xl text-emerald-600">
                    ✓
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-card-foreground">Attendance recorded</h2>
                    <p className="mt-1 text-muted-foreground">
                        {department.name} · {entries.length} students
                    </p>
                    {!session.finished && (
                        <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            in progress
                        </span>
                    )}
                </div>

                <div className="grid w-full grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-border bg-card py-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
                        <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card py-4 text-center">
                        <p className="text-2xl font-bold text-destructive">{absentCount}</p>
                        <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card py-4 text-center">
                        <p className="text-2xl font-bold text-muted-foreground">{unmarkedCount}</p>
                        <p className="text-xs text-muted-foreground">Unmarked</p>
                    </div>
                </div>

                <div className="w-full">
                    <h3 className="mb-2 text-sm font-semibold text-card-foreground">Remarks</h3>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        onBlur={saveRemarks}
                        placeholder="What did you teach this session? (optional)"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </div>

                {absentees.length > 0 && (
                    <div className="w-full">
                        <h3 className="mb-2 text-sm font-semibold text-card-foreground">Absentees</h3>
                        <div className="overflow-hidden rounded-2xl border border-border">
                            {absentees.map(({ student }) => (
                                <div
                                    key={student.studentID}
                                    className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0"
                                >
                                    <span className="text-sm text-card-foreground">{student.name}</span>
                                    <span className="text-sm tabular-nums text-muted-foreground">
                                        Roll {student.rollNumber}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex w-full gap-3">
                    <Link
                        href={`/session/edit/${session.sessionID}`}
                        className="flex-1 rounded-xl border border-border bg-card py-3 text-center text-sm font-semibold text-card-foreground"
                    >
                        Edit attendance
                    </Link>
                    <Link
                        href="/sessions"
                        className="flex-1 rounded-xl border border-border bg-card py-3 text-center text-sm font-semibold text-card-foreground"
                    >
                        View history
                    </Link>
                </div>

                <Link
                    href="/"
                    className="w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground"
                >
                    Back to Home
                </Link>
            </div>
        </main>
    );
}