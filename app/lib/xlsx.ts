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
import { buildAttendanceExportGrid, type ExportLetterhead } from "./csv";
import type { DepartmentAttendanceExport } from "./queries";

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