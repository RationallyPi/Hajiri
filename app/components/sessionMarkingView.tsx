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
        await finishSession(sessionID); // no-op if it's already finished — just re-affirms it
        router.push(`/summary/${sessionID}`);
    };

    const title = department?.name ?? "Session";
    const dateLabel = (sessionDate ?? new Date()).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    if (loading) {
        return (
            <main className="flex min-h-screen flex-col bg-background">
                <Navbar title={title} date={dateLabel} onFinish={handleFinish} backHref={backHref} />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</p>
            </main>
        );
    }

    if (!active) {
        return (
            <main className="flex min-h-screen flex-col bg-background">
                <Navbar title={title} date={dateLabel} onFinish={handleFinish} backHref={backHref} />
                <p className="flex flex-1 items-center justify-center text-muted-foreground">
                    No students in this course.
                </p>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title={title} date={dateLabel} onFinish={handleFinish} backHref={backHref} />

            <div className="px-4 pt-4">
                <RollNumberPicker
                    students={roster.map((r) => ({ rollNumber: r.student.rollNumber, status: r.status }))}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                />
            </div>

            <div className="flex flex-1 p-4">
                <SwipeableCard onSwipeRight={() => mark("present")} onSwipeLeft={() => mark("absent")}>
                    {(triggerSwipe) => (
                        <StudentCard
                            name={active.student.name}
                            rollNumber={active.student.rollNumber}
                            photo={photoUrls[active.student.studentID] ?? "/student-placeholder.png"}
                            attendancePercentage={active.attendancePercentage ?? 0}
                            onMarkPresent={() => triggerSwipe("right")}
                            onMarkAbsent={() => triggerSwipe("left")}
                        />
                    )}
                </SwipeableCard>
            </div>
        </main>
    );
}