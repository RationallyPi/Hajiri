// Real .xlsx export — same underlying data/layout as the CSV/TSV export
// (see buildAttendanceExportGrid in ./csv), but written as an actual binary
// spreadsheet. This is what opens directly in Excel/Google Sheets/WPS on a
// phone without needing a "what app opens .csv?" dialog.
//
// Requires the "xlsx" (SheetJS) package: npm install xlsx
//
// Note: the free/community build of SheetJS supports merged cells (used
// below so the letterhead lines span the full table width) but not per-cell
// styling like bold text or true center-alignment — that's a Pro-only
// feature. If you want fully styled cells later, swap this out for the
// "exceljs" package instead, which supports styling in its free tier too,
// at the cost of a heavier dependency.
import * as XLSX from "xlsx";
import { buildAttendanceExportGrid, studentRowsFromGrid, type ExportLetterhead } from "./csv";
import type { BulkAddStudentRow, DepartmentAttendanceExport } from "./queries";

export function buildAttendanceExportXlsx(
    data: DepartmentAttendanceExport,
    letterhead: ExportLetterhead,
): Blob {
    const grid = buildAttendanceExportGrid(data, letterhead);
    const totalCols = grid.reduce((max, row) => Math.max(max, row.length), 1);

    const ws = XLSX.utils.aoa_to_sheet(grid);

    // Any row with exactly one non-empty cell (letterhead lines, class
    // detail lines, the sign-off lines) gets merged across the full table
    // width — everything else (blank rows, the header, student rows) is
    // left as individual cells.
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    grid.forEach((row, rowIndex) => {
        const filledCount = row.filter((cell) => cell !== "" && cell !== undefined).length;
        if (filledCount === 1) {
            merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: totalCols - 1 } });
        }
    });
    ws["!merges"] = merges;
    ws["!cols"] = new Array(totalCols).fill({ wch: 14 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    return new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

// Reads the first sheet of an .xlsx file and pulls "roll no, name" rows out
// of the first two columns — mirrors parseStudentsCsv/parseStudentsTsv in
// ./csv, just starting from a binary workbook instead of delimited text.
// Anything past column B is ignored, so a student roster exported from this
// app itself (with all the extra attendance columns) can't accidentally be
// re-imported as a bulk-add file — only a plain two-column roster works.
export async function parseStudentsXlsx(file: File): Promise<BulkAddStudentRow[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];

    const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const stringGrid = grid.map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())));

    return studentRowsFromGrid(stringGrid);
}