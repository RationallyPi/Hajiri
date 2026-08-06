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

// Parses "roll no, name" CSV text into rows. Accepts an optional header row
// (skipped automatically if the first cell of the first line isn't a number)
// and skips any blank lines.
export function parseStudentsCsv(text: string): BulkAddStudentRow[] {
    const lines = text
        .split(/\r\n|\r|\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    const firstCells = splitCsvLine(lines[0]);
    const startIdx = Number.isFinite(Number(firstCells[0])) ? 0 : 1; // skip header row

    const rows: BulkAddStudentRow[] = [];
    for (let i = startIdx; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        const rollNumber = Number(cells[0]);
        const name = (cells[1] ?? "").trim();
        if (!Number.isFinite(rollNumber) || !name) continue;
        rows.push({ rollNumber, name });
    }

    return rows;
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

// A CSV has no real "bold" or "centered" styling, but when opened in Excel/
// Sheets each row lines up under the same columns as the table below it — so
// putting a line of text in the middle column of an otherwise-empty row reads
// as centered relative to the table's width once opened. That's the trick
// used for the university letterhead block below.
function centeredRow(text: string, totalCols: number, centerCol: number): string {
    const row = new Array(totalCols).fill("");
    row[centerCol] = text;
    return row.map(escapeCsvField).join(",");
}

function escapeCsvField(value: string): string {
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

// Letterhead + class details + Roll No/Name/<session P-A columns>/Total
// Attendance/Total Classes/Percentage + teacher sign-off. Percentage is
// present / total finished sessions for the course — an unmarked cell counts
// against the denominator but isn't itself P or A, since "wasn't marked" and
// "was marked absent" are different things worth keeping visually distinct.
export function buildAttendanceExportCsv(data: DepartmentAttendanceExport): string {
    const { department, students, sessions, attendanceBySession } = data;
    const sessionLabels = buildSessionDateLabels(sessions);

    const header = ["Roll No", "Name", ...sessionLabels, "Total Attendance", "Total Classes", "Percentage"];
    const totalCols = header.length;
    const centerCol = Math.floor((totalCols - 1) / 2);

    const lines: string[] = [];

    // --- Letterhead ---
    lines.push(centeredRow("Tribhuvan University", totalCols, centerCol));
    lines.push(centeredRow("Institute of Forestry", totalCols, centerCol));
    lines.push(centeredRow("Pokhara Campus, Pokhara", totalCols, centerCol));
    lines.push(
        centeredRow(
            department.academicYear ? `Academic Year: ${department.academicYear}` : "Academic Year .................",
            totalCols,
            centerCol,
        ),
    );
    lines.push("");

    // --- Class details, left-aligned ---
    lines.push(escapeCsvField(`Level: ${department.level}`));
    lines.push(escapeCsvField(`Subject: ${department.name}`));
    lines.push(escapeCsvField(`Course Code: ${department.courseCode}`));
    lines.push(escapeCsvField(`Group: ${department.group}`));
    lines.push("");

    // --- Attendance table ---
    lines.push(header.map(escapeCsvField).join(","));

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

        const row = [
            String(student.rollNumber),
            student.name,
            ...cells,
            String(present),
            String(totalClasses),
            `${percentage}%`,
        ];
        lines.push(row.map(escapeCsvField).join(","));
    }

    // --- Sign-off ---
    lines.push("");
    lines.push("");
    lines.push(escapeCsvField(`Teacher: ${department.teacherName}`));
    lines.push("");
    lines.push(escapeCsvField("Signature: ______________________"));

    return lines.join("\r\n");
}