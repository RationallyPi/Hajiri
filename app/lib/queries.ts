import { db } from "./db";
import type { Attendance, AttendanceStatus, Department, Profile, Session, Student } from "./db";

/* --------------------------------- Profile --------------------------------- */

const PROFILE_ID = 1; // singleton row

const emptyProfile = (): Profile => ({
    profileID: PROFILE_ID,
    professorName: "",
    photo: null,
    email: "",
    institution: "",
    department: "",
    resendApiKey: "",
    resendFromEmail: "",
});

// Always resolves to a row — creates a blank default on first call so the
// Home screen never has to special-case "no profile yet".
export const getProfile = async (): Promise<Profile> => {
    const existing = await db.profile.get(PROFILE_ID);
    if (existing) return existing;
    const fresh = emptyProfile();
    await db.profile.put(fresh);
    return fresh;
};

export const updateProfile = (
    changes: Partial<
        Pick<
            Profile,
            "professorName" | "photo" | "email" | "institution" | "department" | "resendApiKey" | "resendFromEmail"
        >
    >,
) =>
    db.transaction("rw", db.profile, async () => {
        const current = (await db.profile.get(PROFILE_ID)) ?? emptyProfile();
        await db.profile.put({ ...current, ...changes });
    });

/* ------------------------------ Departments ------------------------------ */

export const getDepartments = (): Promise<Department[]> => db.departments.orderBy("name").toArray();

export const getDepartment = (departmentID: number): Promise<Department | undefined> =>
    db.departments.get(departmentID);

export interface DepartmentInput {
    name: string; // Subject
    courseCode: string; // e.g. "CSC 205"
    year: string; // e.g. "3"
    semester: string; // e.g. "2"
    group: string; // Group / Section
    academicYear: string; // e.g. "2082/083"
}

export const addDepartment = (input: DepartmentInput): Promise<number> =>
    db.departments.add({ ...input } as Department);

export const updateDepartment = (departmentID: number, changes: Partial<DepartmentInput>) =>
    db.departments.update(departmentID, changes);

// Creates a new course with the given details and copies every student from
// `sourceDepartmentID` into it (same roll numbers, names, and photos), but as
// brand-new student records under the new course — no attendance history is
// copied, since this is meant for "same class, new semester" reuse, not for
// merging history. Photos are copied by reusing the same Blob reference,
// which is cheap and safe since Blobs are immutable; each new record can
// later get its own photo without touching the original course's. Year,
// semester, and group are passed in separately (not just copied) since a new
// semester is exactly the case where these are likely to change (e.g. year
// "3" semester "1" -> semester "2") even though the roster doesn't. The
// teacher shown on reports always comes from Profile, so there's nothing
// teacher-related to copy here.
export const duplicateDepartment = (sourceDepartmentID: number, input: DepartmentInput): Promise<number> =>
    db.transaction("rw", db.departments, db.students, async () => {
        const newDepartmentID = (await db.departments.add({ ...input } as Department)) as number;

        const students = await db.students.where("departmentID").equals(sourceDepartmentID).toArray();
        for (const s of students) {
            await db.students.add({
                departmentID: newDepartmentID,
                rollNumber: s.rollNumber,
                name: s.name,
                photo: s.photo,
            } as Student);
        }

        return newDepartmentID;
    });

// Deleting a course wipes its students and every attendance/session record tied
// to them — confirm with the user before calling this.
export const deleteDepartment = (departmentID: number) =>
    db.transaction("rw", db.departments, db.students, db.sessions, db.attendance, async () => {
        const students = await db.students.where("departmentID").equals(departmentID).toArray();
        const studentIDs = students.map((s) => s.studentID);
        if (studentIDs.length > 0) {
            await db.attendance.where("studentID").anyOf(studentIDs).delete();
        }
        await db.students.where("departmentID").equals(departmentID).delete();
        await db.sessions.where("departmentID").equals(departmentID).delete();
        await db.departments.delete(departmentID);
    });

/* -------------------------------- Students -------------------------------- */

export const getStudentsByDepartment = (departmentID: number): Promise<Student[]> =>
    db.students.where("departmentID").equals(departmentID).sortBy("rollNumber");

export const addStudent = (student: Omit<Student, "studentID">): Promise<number> =>
    db.students.add(student as Student);

export const updateStudent = (studentID: number, changes: Partial<Student>) =>
    db.students.update(studentID, changes);

export interface BulkAddStudentRow {
    rollNumber: number;
    name: string;
}

export interface BulkAddStudentsResult {
    added: number;
    skipped: (BulkAddStudentRow & { reason: string })[];
}

// Used for CSV import. Every student is added with photo: null — the UI falls
// back to the placeholder image for these until a real photo is uploaded, same
// as any manually-added student without a photo yet. Rows are added one at a
// time with their own try/catch *inside* the transaction: Dexie only aborts a
// transaction on an unhandled rejection, so catching the duplicate-roll-number
// error here lets the rest of the CSV keep importing instead of the whole
// import failing because of one bad row.
export const bulkAddStudents = (
    departmentID: number,
    rows: BulkAddStudentRow[],
): Promise<BulkAddStudentsResult> =>
    db.transaction("rw", db.students, async () => {
        const result: BulkAddStudentsResult = { added: 0, skipped: [] };

        for (const row of rows) {
            if (!row.rollNumber || !row.name.trim()) {
                result.skipped.push({ ...row, reason: "missing roll number or name" });
                continue;
            }
            try {
                await db.students.add({
                    departmentID,
                    rollNumber: row.rollNumber,
                    name: row.name.trim(),
                    photo: null,
                } as Student);
                result.added++;
            } catch {
                result.skipped.push({ ...row, reason: "roll number already exists in this course" });
            }
        }

        return result;
    });

// Removes a student and every attendance row tied to them. Used both by the
// per-row delete button and (potentially) any bulk-delete UI — always confirm
// with the user before calling this, since it's not undoable.
export const deleteStudent = (studentID: number) =>
    db.transaction("rw", db.students, db.attendance, async () => {
        await db.attendance.where("studentID").equals(studentID).delete();
        await db.students.delete(studentID);
    });

/* -------------------------------- Sessions -------------------------------- */

// Resumes the department's unfinished session if one exists — no matter how
// long ago it was started. This is what guarantees at most one "in progress"
// session per course at any time: if you started Attendance A, backed out,
// then started and finished Attendance B, A is still sitting there
// unfinished; coming back to A two days (or two weeks) later reuses that
// same session and its original `date`, instead of silently spawning a
// second in-progress session for the same course. Only when there's truly no
// unfinished session left does this create a new one.
export const getOrCreateActiveSession = (departmentID: number): Promise<Session> =>
    // Atomic: without a transaction, two near-simultaneous calls (e.g. React
    // Strict Mode double-invoking the effect that calls this) can both run the
    // "does one exist?" check before either has inserted, and both end up
    // inserting a session — leaving one duplicate orphaned as "in progress"
    // forever. Wrapping check + insert in one rw transaction on `sessions`
    // makes Dexie serialize concurrent calls, so the second call sees the
    // first's insert and reuses it instead of creating a duplicate.
    db.transaction("rw", db.sessions, async () => {
        const existing = await db.sessions
            .where("departmentID")
            .equals(departmentID)
            .and((s) => !s.finished)
            .first();

        if (existing) return existing;

        const sessionID = await db.sessions.add({
            departmentID,
            date: new Date(),
            finished: false,
            finishedAt: null,
            remarks: "",
        } as Session);

        return (await db.sessions.get(sessionID))!;
    });

export const updateSessionRemarks = (sessionID: number, remarks: string) =>
    db.sessions.update(sessionID, { remarks });

export const getSession = (sessionID: number): Promise<Session | undefined> => db.sessions.get(sessionID);

// Stamps `finishedAt` every time Finish is pressed — including re-finishing
// a session that was started days ago and picked back up later via Edit, so
// the recorded time always reflects the *last* time it was finished, not
// when it was first created.
export const finishSession = (sessionID: number) =>
    db.sessions.update(sessionID, { finished: true, finishedAt: new Date() });

// Removes the session and every attendance row tied to it — use for botched
// test sessions. Doesn't touch students or the course itself.
export const deleteSession = (sessionID: number) =>
    db.transaction("rw", db.sessions, db.attendance, async () => {
        await db.attendance.where("sessionID").equals(sessionID).delete();
        await db.sessions.delete(sessionID);
    });

export const getAllSessions = async (): Promise<Session[]> => {
    const sessions = await db.sessions.toArray();
    return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
};

export const getSessionsByDepartment = async (departmentID: number): Promise<Session[]> => {
    const sessions = await db.sessions.where("departmentID").equals(departmentID).toArray();
    return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
};
/* ------------------------------- Attendance ------------------------------- */

export const getAttendanceForSession = async (sessionID: number): Promise<Map<number, boolean>> => {
    const rows = await db.attendance.where("sessionID").equals(sessionID).toArray();
    return new Map(rows.map((r) => [r.studentID, r.status]));
};

// put() upserts — re-marking a student just overwrites their previous mark for this session.
export const markAttendance = (sessionID: number, studentID: number, status: boolean) =>
    db.attendance.put({ sessionID, studentID, status });

// Sparse model: unmarked sessions leave no row, so this is present-count / marked-count,
// not present-count / total-sessions. Returns null when there's no data yet.
export const getAttendancePercentage = async (studentID: number): Promise<number | null> => {
    const rows = await db.attendance.where("studentID").equals(studentID).toArray();
    if (rows.length === 0) return null;
    const present = rows.filter((r) => r.status).length;
    return Math.round((present / rows.length) * 100);
};

export interface DepartmentAttendanceExport {
    department: Department;
    students: Student[];
    sessions: Session[]; // finished sessions only, chronological
    attendanceBySession: Map<number, Map<number, boolean>>; // sessionID -> studentID -> present
}

// Pulls everything needed for the "export whole-course attendance" CSV in one
// go: every student, every *finished* session (in-progress ones aren't
// counted yet), and the per-student status for each. Only finished sessions
// count — an in-progress session shouldn't drag down anyone's percentage
// before the teacher has actually marked it.
export const getDepartmentAttendanceExport = async (
    departmentID: number,
): Promise<DepartmentAttendanceExport | null> => {
    const department = await db.departments.get(departmentID);
    if (!department) return null;

    const [students, sessions] = await Promise.all([
        getStudentsByDepartment(departmentID),
        db.sessions
            .where("departmentID")
            .equals(departmentID)
            .and((s) => s.finished)
            .toArray(),
    ]);
    sessions.sort((a, b) => a.date.getTime() - b.date.getTime());

    const attendanceBySession = new Map<number, Map<number, boolean>>();
    await Promise.all(
        sessions.map(async (session) => {
            const rows = await db.attendance.where("sessionID").equals(session.sessionID).toArray();
            attendanceBySession.set(session.sessionID, new Map(rows.map((r) => [r.studentID, r.status])));
        }),
    );

    return { department, students, sessions, attendanceBySession };
};

export interface SessionCounts {
    present: number;
    absent: number;
    unmarked: number;
    total: number;
}

// Lightweight counts only — used for the history list so it doesn't have to
// pull every Student record for every session just to show three numbers.
export const getSessionCounts = async (session: Session): Promise<SessionCounts> => {
    const [rows, total] = await Promise.all([
        db.attendance.where("sessionID").equals(session.sessionID).toArray(),
        db.students.where("departmentID").equals(session.departmentID).count(),
    ]);
    const present = rows.filter((r) => r.status).length;
    const absent = rows.filter((r) => !r.status).length;
    return { present, absent, unmarked: total - rows.length, total };
};

export interface SessionSummaryEntry {
    student: Student;
    status: AttendanceStatus;
}

export interface SessionSummary {
    session: Session;
    department: Department;
    entries: SessionSummaryEntry[];
    presentCount: number;
    absentCount: number;
    unmarkedCount: number;
}

// Full detail — every student in the course with their status for this session.
// Used by the post-Finish summary page and by clicking into a session from history.
export const getSessionSummary = async (sessionID: number): Promise<SessionSummary | null> => {
    const session = await db.sessions.get(sessionID);
    if (!session) return null;

    const [department, students, attendanceRows] = await Promise.all([
        db.departments.get(session.departmentID),
        getStudentsByDepartment(session.departmentID),
        db.attendance.where("sessionID").equals(sessionID).toArray(),
    ]);
    if (!department) return null;

    const attendanceMap = new Map(attendanceRows.map((r) => [r.studentID, r.status]));
    const entries: SessionSummaryEntry[] = students.map((student) => {
        const marked = attendanceMap.get(student.studentID);
        const status: AttendanceStatus = marked === undefined ? "unmarked" : marked ? "present" : "absent";
        return { student, status };
    });

    return {
        session,
        department,
        entries,
        presentCount: entries.filter((e) => e.status === "present").length,
        absentCount: entries.filter((e) => e.status === "absent").length,
        unmarkedCount: entries.filter((e) => e.status === "unmarked").length,
    };
};