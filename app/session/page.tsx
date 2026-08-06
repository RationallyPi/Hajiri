"use client";

import { useState } from "react";
import Navbar from "../components/navbar";
import StudentCard from "../components/studentCard";
import RollNumberPicker, { type AttendanceStatus } from "../components/rollNumberPicker";
import SwipeableCard from "../components/swipeableCard";

interface Student {
    rollNumber: number;
    name: string;
    photo: string;
    attendancePercentage: number;
    status: AttendanceStatus;
}

/* ------------------------------------------------------------------ */
/* Dummy data — replace with your IndexedDB read for the session      */
/* ------------------------------------------------------------------ */
const DUMMY_NAMES = [
    "Aarav Sharma", "Bibek Thapa", "Chandra Gurung", "Deepika Rai", "Esha Karki",
    "Fatima Sheikh", "Gopal Adhikari", "Hema Poudel", "Ishan Bhattarai", "Jyoti Shrestha",
    "Kabin Magar", "Laxmi Tamang", "Manish Basnet", "Nisha Khadka", "Oman Lama",
    "Prakash Neupane", "Rita Baniya", "Suman Chhetri", "Tara Devkota", "Utsav Pandey",
];

const DUMMY_STUDENTS: Student[] = DUMMY_NAMES.map((name, i) => ({
    rollNumber: i + 1,
    name,
    photo: "/student.jpg",
    attendancePercentage: 60 + ((i * 7) % 40), // deterministic, avoids SSR/CSR mismatch
    status: "unmarked",
}));

export default function SessionPage() {
    const [students, setStudents] = useState<Student[]>(DUMMY_STUDENTS);
    const [activeIndex, setActiveIndex] = useState(0);

    const active = students[activeIndex];

    const mark = (status: AttendanceStatus) => {
        setStudents((prev) => {
            const next = [...prev];
            next[activeIndex] = { ...next[activeIndex], status };
            return next;
        });
        // TODO: persist to IndexedDB here, e.g.
        // db.attendance.put({ rollNumber: active.rollNumber, status, date: today });

        setActiveIndex((idx) => Math.min(idx + 1, students.length - 1));
    };

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar />

            <div className="px-4 pt-4">
                <RollNumberPicker
                    students={students.map((s) => ({ rollNumber: s.rollNumber, status: s.status }))}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                />
            </div>

            <div className="flex flex-1 p-4">
                <SwipeableCard onSwipeRight={() => mark("present")} onSwipeLeft={() => mark("absent")}>
                    <StudentCard
                        name={active.name}
                        rollNumber={active.rollNumber}
                        photo={active.photo}
                        attendancePercentage={active.attendancePercentage}
                    />
                </SwipeableCard>
            </div>
        </main>
    );
}