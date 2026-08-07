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

// Singleton settings row — always stored/read at profileID = 1. Holds the
// professor's display info shown on the Home screen (photo + name above the
// "Hajiri" app title). A profile row always exists once the DB has been
// touched — getProfile() in queries.ts creates a blank default on first read
// so callers never have to null-check "no profile yet" separately from
// "no name set yet".
export interface Profile {
    profileID: number;
    professorName: string;
    photo: Blob | null;
    email: string; // used as the recipient for "email me the export" — blank means that option stays disabled
    institution: string; // e.g. "Institute of Forestry"
    department: string; // the professor's own department/faculty — distinct from the per-course `Department` entity above
    resendApiKey: string; // pasted in via Settings > Email — lets "Email CSV" work without a server .env file
    resendFromEmail: string; // optional sender override, e.g. "Hajiri <you@yourdomain.com>"; blank = use the server default
}

// Derived UI-facing status — not stored directly. "unmarked" means no Attendance row exists yet.
export type AttendanceStatus = "unmarked" | "present" | "absent";

class AttendanceDB extends Dexie {
    departments!: Table<Department, number>;
    students!: Table<Student, number>;
    sessions!: Table<Session, number>;
    attendance!: Table<Attendance, [number, number]>;
    profile!: Table<Profile, number>;

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

        // New `profile` store for the professor's Home-screen display info
        // (photo + name). Singleton — one row, keyed by profileID (always 1).
        // Existing stores are unchanged, so no upgrade/backfill is needed here.
        this.version(5).stores({
            departments: "++departmentID, name",
            students: "++studentID, departmentID, &[departmentID+rollNumber]",
            sessions: "++sessionID, departmentID, date",
            attendance: "[sessionID+studentID], sessionID, studentID",
            profile: "profileID",
        });

        // Adds email/institution/department to the profile row (email is what
        // the "Email CSV" export button sends to). None of these are indexed,
        // so the store definition is unchanged — only the existing profile
        // row needs the new fields backfilled so they're never `undefined`.
        this.version(6)
            .stores({
                departments: "++departmentID, name",
                students: "++studentID, departmentID, &[departmentID+rollNumber]",
                sessions: "++sessionID, departmentID, date",
                attendance: "[sessionID+studentID], sessionID, studentID",
                profile: "profileID",
            })
            .upgrade((tx) =>
                tx
                    .table("profile")
                    .toCollection()
                    .modify((p) => {
                        p.email = p.email ?? "";
                        p.institution = p.institution ?? "";
                        p.department = p.department ?? "";
                    }),
            );

        // Adds resendApiKey/resendFromEmail so the Resend key can be pasted
        // in from Settings > Email instead of requiring a server .env file.
        // Same pattern as v6 — unindexed fields, just backfilled.
        this.version(7)
            .stores({
                departments: "++departmentID, name",
                students: "++studentID, departmentID, &[departmentID+rollNumber]",
                sessions: "++sessionID, departmentID, date",
                attendance: "[sessionID+studentID], sessionID, studentID",
                profile: "profileID",
            })
            .upgrade((tx) =>
                tx
                    .table("profile")
                    .toCollection()
                    .modify((p) => {
                        p.resendApiKey = p.resendApiKey ?? "";
                        p.resendFromEmail = p.resendFromEmail ?? "";
                    }),
            );
    }
}

// indexedDB doesn't exist during Next.js server rendering — only instantiate in the browser
export const db: AttendanceDB =
    typeof window !== "undefined" ? new AttendanceDB() : (null as unknown as AttendanceDB);