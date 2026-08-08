import type { BulkAddStudentRow, DepartmentAttendanceExport } from "./queries";
import type { Session } from "./db";

// Splits one CSV line into fields, respecting basic double-quoted fields
// (so names like "Smith, John" don't get split on their internal comma).
// Deliberately simple — this app only needs two plain columns, not a full
// RFC 4180 parser.
function splitCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            fields.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    fields.push(current.trim());
    return fields;
}

// TSV has no standard quoting convention, so unlike CSV there's no need to
// track quote state — a raw split on tabs is the normal way to read it.
function splitTsvLine(line: string): string[] {
    return line.split("\t").map((cell) => cell.trim());
}

// Shared by parseStudentsCsv/parseStudentsTsv and (indirectly) the XLSX
// importer — turns a grid of already-split rows into BulkAddStudentRow[].
// Accepts an optional header row (skipped automatically if the first cell of
// the first row isn't a number) and skips any blank rows.
export function studentRowsFromGrid(grid: string[][]): BulkAddStudentRow[] {
    const nonEmpty = grid.filter((row) => row.some((cell) => cell.trim().length > 0));
    if (nonEmpty.length === 0) return [];

    const startIdx = Number.isFinite(Number(nonEmpty[0][0])) ? 0 : 1; // skip header row

    const rows: BulkAddStudentRow[] = [];
    for (let i = startIdx; i < nonEmpty.length; i++) {
        const cells = nonEmpty[i];
        const rollNumber = Number(cells[0]);
        const name = (cells[1] ?? "").trim();
        if (!Number.isFinite(rollNumber) || !name) continue;
        rows.push({ rollNumber, name });
    }

    return rows;
}

// Parses "roll no, name" CSV text into rows.
export function parseStudentsCsv(text: string): BulkAddStudentRow[] {
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
    return studentRowsFromGrid(lines.map(splitCsvLine));
}

// Same as parseStudentsCsv, but tab-delimited.
export function parseStudentsTsv(text: string): BulkAddStudentRow[] {
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
    return studentRowsFromGrid(lines.map(splitTsvLine));
}

// One column per finished session, labeled by date only (no time — a class
// only ever runs once a day in practice, but on the rare day two periods of
// the same course both got finished, we disambiguate with "(1)" / "(2)"
// rather than silently colliding into one column).
function buildSessionDateLabels(sessions: Session[]): string[] {
    const dateOnly = (d: Date) =>
        d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const dateStrs = sessions.map((s) => dateOnly(s.date));
    const totalPerDate = new Map<string, number>();
    dateStrs.forEach((ds) => totalPerDate.set(ds, (totalPerDate.get(ds) ?? 0) + 1));

    const seenPerDate = new Map<string, number>();
    return dateStrs.map((ds) => {
        const total = totalPerDate.get(ds)!;
        if (total <= 1) return ds;
        const seen = (seenPerDate.get(ds) ?? 0) + 1;
        seenPerDate.set(ds, seen);
        return `${ds} (${seen})`;
    });
}

export type ExportLetterhead = { institution: string; department: string; professorName: string };

// A CSV/TSV has no real "bold" or "centered" styling, but when opened in
// Excel/Sheets each row lines up under the same columns as the table below
// it — so putting a value in the middle column of an otherwise-empty row
// reads as centered relative to the table's width once opened. That's the
// trick used for the letterhead block below. (The XLSX export in xlsx.ts
// does this properly with real merged cells instead.)
function centeredRowCells(text: string, totalCols: number, centerCol: number): string[] {
    const row = new Array(totalCols).fill("");
    row[centerCol] = text;
    return row;
}

function escapeCsvField(value: string): string {
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

// TSV has no standard quoting convention — the usual approach is just to
// strip characters that would break the format (tabs, newlines) rather than
// wrap fields in quotes the way CSV does.
function escapeTsvField(value: string): string {
    return value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

// Builds the export as a plain grid of string cells — letterhead, class
// details, the attendance table, and the sign-off — with no delimiter or
// escaping applied yet. Shared by the CSV, TSV, and XLSX exporters so the
// actual content/layout only has to be defined once. Percentage is present /
// total finished sessions for the course — an unmarked cell counts against
// the denominator but isn't itself P or A, since "wasn't marked" and "was
// marked absent" are different things worth keeping visually distinct.
//
// The letterhead's institution/department/professor name come from the
// professor's Profile (Settings/Customize), not from the per-course
// Department record — those stay the same across every course a professor
// teaches. In particular, the teacher's name is *only* ever pulled from
// Profile (via `letterhead.professorName`) — the Department record has no
// teacher field of its own. Blank values fall back to a dotted placeholder
// line.
export function buildAttendanceExportGrid(
    data: DepartmentAttendanceExport,
    letterhead: ExportLetterhead,
): string[][] {
    const { department, students, sessions, attendanceBySession } = data;
    const sessionLabels = buildSessionDateLabels(sessions);

    const header = ["Roll No", "Name", ...sessionLabels, "Total Attendance", "Total Classes", "Percentage"];
    const totalCols = header.length;
    const centerCol = Math.floor((totalCols - 1) / 2);

    const rows: string[][] = [];

    // --- Letterhead ---
    rows.push(centeredRowCells(letterhead.institution.trim() || "Institution .................", totalCols, centerCol));
    rows.push(centeredRowCells(letterhead.department.trim() || "Department .................", totalCols, centerCol));
    rows.push(
        centeredRowCells(
            department.academicYear ? `Academic Year: ${department.academicYear}` : "Academic Year .................",
            totalCols,
            centerCol,
        ),
    );
    rows.push([]);

    // --- Class details, left-aligned ---
    rows.push([`Year: ${department.year}`]);
    rows.push([`Semester: ${department.semester}`]);
    rows.push([`Subject: ${department.name}`]);
    rows.push([`Course Code: ${department.courseCode}`]);
    rows.push([`Group: ${department.group}`]);
    rows.push([]);

    // --- Attendance table ---
    rows.push(header);

    for (const student of students) {
        let present = 0;
        const cells = sessions.map((session) => {
            const marked = attendanceBySession.get(session.sessionID)?.get(student.studentID);
            if (marked === true) {
                present++;
                return "P";
            }
            if (marked === false) return "A";
            return "";
        });

        const totalClasses = sessions.length;
        const percentage = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0;

        rows.push([
            String(student.rollNumber),
            student.name,
            ...cells,
            String(present),
            String(totalClasses),
            `${percentage}%`,
        ]);
    }

    // --- Sign-off ---
    rows.push([]);
    rows.push([]);
    rows.push([`Teacher: ${letterhead.professorName.trim() || "................."}`]);
    rows.push([]);
    rows.push(["Signature: ______________________"]);

    return rows;
}

export function buildAttendanceExportCsv(data: DepartmentAttendanceExport, letterhead: ExportLetterhead): string {
    const grid = buildAttendanceExportGrid(data, letterhead);
    return grid.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

export function buildAttendanceExportTsv(data: DepartmentAttendanceExport, letterhead: ExportLetterhead): string {
    const grid = buildAttendanceExportGrid(data, letterhead);
    return grid.map((row) => row.map(escapeTsvField).join("\t")).join("\r\n");
}