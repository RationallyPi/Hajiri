"use client";

import { useEffect, useState } from "react";
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

    const mark = async (status: AttendanceStatus) => {
        if (!active || status === "unmarked") return;
        await markAttendance(sessionID, active.student.studentID, status === "present");
        setRoster((prev) => {
            const next = [...prev];
            next[activeIndex] = { ...next[activeIndex], status };
            return next;
        });
        setActiveIndex((idx) => Math.min(idx + 1, roster.length - 1));
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
                <Navbar title={title} date={dateLabel} onFinish={handleFinish} backHref={backHref} />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</p>
            </main>
        );
    }

    if (!active) {
        return (
            <main className="flex h-screen flex-col overflow-hidden bg-background">
                <Navbar title={title} date={dateLabel} onFinish={handleFinish} backHref={backHref} />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">
                    No students in this course.
                </p>
            </main>
        );
    }

    return (
        <main className="flex h-screen flex-col overflow-hidden bg-background">
            <Navbar title={title} date={dateLabel} onFinish={handleFinish} backHref={backHref} />

            <div className="shrink-0 px-4 pt-4">
                <RollNumberPicker
                    students={roster.map((r) => ({ rollNumber: r.student.rollNumber, status: r.status }))}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                />
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