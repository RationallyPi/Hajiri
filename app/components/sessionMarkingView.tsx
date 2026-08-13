"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./navbar";
import StudentCard from "./studentCard";
import RollNumberPicker, { type AttendanceStatus } from "./rollNumberPicker";
import SwipeableCard from "./swipeableCard";
import type { Department, Student } from "../lib/db";
import {
    finishSession,
    getAttendanceForSession,
    getAttendancePercentage,
    getDepartment,
    getSession,
    getStudentsByDepartment,
    markAttendance,
    unmarkAttendance,
} from "../lib/queries";

interface RosterEntry {
    student: Student;
    status: AttendanceStatus;
    attendancePercentage: number | null;
}

interface SessionMarkingViewProps {
    sessionID: number;
    // where Back should go — Home for a live session, the summary page when editing
    backHref?: string;
}

export default function SessionMarkingView({ sessionID, backHref = "/" }: SessionMarkingViewProps) {
    const router = useRouter();

    const [department, setDepartment] = useState<Department | null>(null);
    const [sessionDate, setSessionDate] = useState<Date | null>(null);
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    // kept separate from `roster` — roster changes on every mark(), and revoking
    // these on every re-render would break the images currently on screen
    const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showUnmarkedModal, setShowUnmarkedModal] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            const session = await getSession(sessionID);
            if (!session) {
                if (!cancelled) setLoading(false);
                return;
            }

            const [dept, students, attendanceMap] = await Promise.all([
                getDepartment(session.departmentID),
                getStudentsByDepartment(session.departmentID),
                getAttendanceForSession(sessionID),
            ]);

            const entries: RosterEntry[] = await Promise.all(
                students.map(async (student) => {
                    const marked = attendanceMap.get(student.studentID);
                    const status: AttendanceStatus =
                        marked === undefined ? "unmarked" : marked ? "present" : "absent";
                    const attendancePercentage = await getAttendancePercentage(student.studentID);
                    return { student, status, attendancePercentage };
                }),
            );

            if (cancelled) return;
            setDepartment(dept ?? null);
            setSessionDate(session.date);
            setRoster(entries);
            setActiveIndex(0);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [sessionID]);

    useEffect(() => {
        const urls: Record<number, string> = {};
        roster.forEach(({ student }) => {
            if (student.photo) urls[student.studentID] = URL.createObjectURL(student.photo);
        });
        setPhotoUrls(urls);
        return () => {
            Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roster.map((r) => r.student.studentID).join(",")]);

    const active = roster[activeIndex];
    const unmarkedEntries = roster.filter((r) => r.status === "unmarked");

    // Every mark pushes the student's previous status onto an undo stack so a
    // mistaken swipe can be reverted one step at a time. Mark-all-present
    // pushes one entry per student it touched.
    const undoStack = useRef<{ studentID: number; previousStatus: AttendanceStatus }[]>([]);
    const [undoDepth, setUndoDepth] = useState(0);

    const persistMark = (studentID: number, status: AttendanceStatus) =>
        status === "unmarked"
            ? unmarkAttendance(sessionID, studentID)
            : markAttendance(sessionID, studentID, status === "present");

    const mark = async (status: AttendanceStatus, idx = activeIndex) => {
        const target = roster[idx];
        if (!target || status === "unmarked") return;
        undoStack.current.push({ studentID: target.student.studentID, previousStatus: target.status });
        await persistMark(target.student.studentID, status);
        setRoster((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status };
            return next;
        });
        setUndoDepth(undoStack.current.length);
        setActiveIndex(() => Math.min(idx + 1, roster.length - 1));
    };

    const markAllPresent = async () => {
        const targets = roster.filter((r) => r.status === "unmarked");
        if (targets.length === 0) return;
        for (const t of targets) {
            undoStack.current.push({ studentID: t.student.studentID, previousStatus: "unmarked" });
        }
        await Promise.all(targets.map((t) => markAttendance(sessionID, t.student.studentID, true)));
        setRoster((prev) =>
            prev.map((r) => (r.status === "unmarked" ? { ...r, status: "present" } : r)),
        );
        setUndoDepth(undoStack.current.length);
    };

    const undo = async () => {
        const last = undoStack.current.pop();
        if (!last) return;
        await persistMark(last.studentID, last.previousStatus);
        setRoster((prev) =>
            prev.map((r) =>
                r.student.studentID === last.studentID ? { ...r, status: last.previousStatus } : r,
            ),
        );
        setUndoDepth(undoStack.current.length);
    };

    const handleFinish = async () => {
        if (unmarkedEntries.length > 0) {
            setShowUnmarkedModal(true);
            return;
        }
        await finishSession(sessionID);
        router.push(`/summary/${sessionID}`);
    };

    const goToFirstUnmarked = () => {
        const idx = roster.findIndex((r) => r.status === "unmarked");
        if (idx !== -1) setActiveIndex(idx);
        setShowUnmarkedModal(false);
    };

    const title = department?.name ?? "Session";
    const dateLabel = (sessionDate ?? new Date()).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    if (loading) {
        return (
            <main className="flex h-screen flex-col overflow-hidden bg-background">
                <Navbar
                    title={title}
                    date={dateLabel}
                    onFinish={handleFinish}
                    backHref={backHref}
                    section={department?.group}
                />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</p>
            </main>
        );
    }

    if (!active) {
        return (
            <main className="flex h-screen flex-col overflow-hidden bg-background">
                <Navbar
                    title={title}
                    date={dateLabel}
                    onFinish={handleFinish}
                    backHref={backHref}
                    section={department?.group}
                />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">
                    No students in this course.
                </p>
            </main>
        );
    }

    return (
        <main className="flex h-screen flex-col overflow-hidden bg-background">
            <Navbar
                title={title}
                date={dateLabel}
                onFinish={handleFinish}
                backHref={backHref}
                section={department?.group}
            />

            <div className="shrink-0 px-4 pt-4">
                <RollNumberPicker
                    students={roster.map((r) => ({ rollNumber: r.student.rollNumber, status: r.status }))}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
                <button
                    type="button"
                    onClick={undo}
                    disabled={undoDepth === 0}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-card-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                    ↶ Undo
                </button>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {unmarkedEntries.length} unmarked
                </span>
                <button
                    type="button"
                    onClick={markAllPresent}
                    disabled={unmarkedEntries.length === 0}
                    title="Mark every unmarked student as present"
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Mark all present
                </button>
            </div>

            <div className="flex min-h-0 flex-1 p-4">
                <SwipeableCard onSwipeRight={() => mark("absent")} onSwipeLeft={() => mark("present")}>
                    {(triggerSwipe) => (
                        <StudentCard
                            name={active.student.name}
                            rollNumber={active.student.rollNumber}
                            photo={photoUrls[active.student.studentID] ?? "/student-placeholder.png"}
                            attendancePercentage={active.attendancePercentage ?? 0}
                            onMarkPresent={() => triggerSwipe("left")}
                            onMarkAbsent={() => triggerSwipe("right")}
                        />
                    )}
                </SwipeableCard>
            </div>

            {showUnmarkedModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowUnmarkedModal(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-card-foreground">
                            {unmarkedEntries.length} student{unmarkedEntries.length === 1 ? "" : "s"} not marked yet
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Mark everyone present or absent before finishing this session.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {unmarkedEntries.map((entry) => (
                                <span
                                    key={entry.student.studentID}
                                    className="rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums text-muted-foreground"
                                >
                                    Roll {entry.student.rollNumber}
                                </span>
                            ))}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowUnmarkedModal(false)}
                                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-card-foreground"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={goToFirstUnmarked}
                                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                            >
                                Go to first
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}