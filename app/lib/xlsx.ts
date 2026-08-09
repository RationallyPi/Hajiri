// Real .xlsx export — same underlying data/layout as the CSV/TSV export
// (see buildAttendanceExportGrid in ./csv), but written as an actual binary
// spreadsheet. This is what opens directly in Excel/Google Sheets/WPS on a
// phone without needing a "what app opens .csv?" dialog.
//
// Writing uses "exceljs" rather than "xlsx" (SheetJS) — the free/community
// build of SheetJS supports merged cells, which this export relies on for
// the letterhead/class-detail rows.
// Requires: npm install exceljs
//
// Reading (parseStudentsXlsx, for bulk-importing a student roster) still
// uses "xlsx" below — that direction never needed image support, so there's
// no reason to touch it.
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { buildAttendanceExportGrid, studentRowsFromGrid, type ExportLetterhead } from "./csv";
import type { BulkAddStudentRow, DepartmentAttendanceExport } from "./queries";

export async function buildAttendanceExportXlsx(
    data: DepartmentAttendanceExport,
    letterhead: ExportLetterhead,
): Promise<Blob> {
    const grid = buildAttendanceExportGrid(data, letterhead);
    const totalCols = grid.reduce((max, row) => Math.max(max, row.length), 1);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Attendance");
    ws.columns = new Array(totalCols).fill(null).map(() => ({ width: 14 }));

    grid.forEach((row) => {
        const padded = [...row];
        while (padded.length < totalCols) padded.push("");
        ws.addRow(padded);
    });

    // Any row with exactly one non-empty cell (letterhead lines, class
    // detail lines, the sign-off lines) gets merged across the full table
    // width — everything else (blank rows, the header, student rows) is
    // left as individual cells.
    grid.forEach((row, rowIndex) => {
        const filledCount = row.filter((cell) => cell !== "" && cell !== undefined).length;
        if (filledCount === 1) {
            ws.mergeCells(rowIndex + 1, 1, rowIndex + 1, totalCols);
        }
    });

    const buffer = await wb.xlsx.writeBuffer();
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