import Dexie, { type Table } from "dexie";

export interface Department {
    departmentID: number;
    name: string; // Subject
    courseCode: string; // e.g. "CSC 205"
    level: string; // Year/Semester, e.g. "3/2"
    group: string; // Group / Section name
    academicYear: string; // e.g. "2082/083"
    teacherName: string;
}

export interface Student {
    studentID: number;
    departmentID: number;
    name: string;
    rollNumber: number; // unique within a department, enforced by the schema below
    photo: Blob | null;
}

export interface Session {
    sessionID: number;
    departmentID: number;
    date: Date;
    finished: boolean;
    remarks: string; // what was taught that session — optional in practice, defaults to ""
}

export interface Attendance {
    sessionID: number;
    studentID: number;
    status: boolean; // true = present, false = absent. No row = unmarked.
}

// Derived UI-facing status — not stored directly. "unmarked" means no Attendance row exists yet.
export type AttendanceStatus = "unmarked" | "present" | "absent";

class AttendanceDB extends Dexie {
    departments!: Table<Department, number>;
    students!: Table<Student, number>;
    sessions!: Table<Session, number>;
    attendance!: Table<Attendance, [number, number]>;

    constructor() {
        super("attendanceDB");
        this.version(1).stores({
            departments: "++departmentID, &name",
            // &[departmentID+rollNumber] enforces "roll number unique within a course"
            students: "++studentID, departmentID, &[departmentID+rollNumber]",
            sessions: "++sessionID, departmentID, date",
            // compound primary key = one attendance row per student per session;
            // separate sessionID/studentID indexes so both lookup directions are indexed
            attendance: "[sessionID+studentID], sessionID, studentID",
        });

        // level/group/teacherName aren't indexed, so the store definition itself
        // doesn't need to change — only existing rows need the new fields
        // backfilled so they're never `undefined` in the UI or CSV export.
        this.version(2)
            .stores({
                departments: "++departmentID, &name",
                students: "++studentID, departmentID, &[departmentID+rollNumber]",
                sessions: "++sessionID, departmentID, date",
                attendance: "[sessionID+studentID], sessionID, studentID",
            })
            .upgrade((tx) =>
                tx
                    .table("departments")
                    .toCollection()
                    .modify((d) => {
                        d.level = d.level ?? "";
                        d.group = d.group ?? "";
                        d.teacherName = d.teacherName ?? "";
                    }),
            );

        // courseCode/academicYear aren't indexed either — same pattern as v2,
        // just backfilling the two newest fields on existing rows.
        this.version(3)
            .stores({
                departments: "++departmentID, &name",
                students: "++studentID, departmentID, &[departmentID+rollNumber]",
                sessions: "++sessionID, departmentID, date",
                attendance: "[sessionID+studentID], sessionID, studentID",
            })
            .upgrade((tx) =>
                tx
                    .table("departments")
                    .toCollection()
                    .modify((d) => {
                        d.courseCode = d.courseCode ?? "";
                        d.academicYear = d.academicYear ?? "";
                    }),
            );

        // Drops the unique constraint on `name`. It made sense when name was
        // the only identifying field, but now that Course Code/Level/Group/
        // Academic Year all exist, two sections of the *same subject* (e.g.
        // "Data Structures" for Group A and Group B) are legitimate and were
        // being wrongly blocked. `name` stays indexed (just not unique) since
        // getDepartments() still orderBy's it. No data changes needed — only
        // the index constraint changes.
        this.version(4).stores({
            departments: "++departmentID, name",
            students: "++studentID, departmentID, &[departmentID+rollNumber]",
            sessions: "++sessionID, departmentID, date",
            attendance: "[sessionID+studentID], sessionID, studentID",
        });
    }
}

// indexedDB doesn't exist during Next.js server rendering — only instantiate in the browser
export const db: AttendanceDB =
    typeof window !== "undefined" ? new AttendanceDB() : (null as unknown as AttendanceDB);