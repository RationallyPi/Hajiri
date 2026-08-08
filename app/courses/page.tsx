"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Navbar from "../components/navbar";
import type { Department, Profile, Student } from "../lib/db";
import {
    addDepartment,
    addStudent,
    bulkAddStudents,
    deleteDepartment,
    deleteStudent,
    type DepartmentInput,
    duplicateDepartment,
    getDepartmentAttendanceExport,
    getDepartments,
    getProfile,
    getStudentsByDepartment,
    updateDepartment,
    updateStudent,
} from "../lib/queries";
import { buildAttendanceExportCsv, buildAttendanceExportTsv, parseStudentsCsv } from "../lib/csv";
import { buildAttendanceExportXlsx } from "../lib/xlsx";

export default function CoursesPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [departmentID, setDepartmentID] = useState<number | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});

    const emptyDeptForm: DepartmentInput = {
        name: "",
        courseCode: "",
        level: "",
        group: "",
        academicYear: "",
        teacherName: "",
    };
    const [newDept, setNewDept] = useState<DepartmentInput>(emptyDeptForm);

    // Edit and Duplicate both reuse the same 4-field panel — `deptFormMode`
    // says which action Save should perform, `deptForm` holds the field values.
    type DeptFormMode = { type: "edit"; departmentID: number } | { type: "duplicate"; sourceDepartmentID: number };
    const [deptFormMode, setDeptFormMode] = useState<DeptFormMode | null>(null);
    const [deptForm, setDeptForm] = useState<DepartmentInput>(emptyDeptForm);

    const [newStudent, setNewStudent] = useState({ rollNumber: "", name: "" });
    const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
    const newPhotoInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState<"csv" | "tsv" | "xlsx">("csv");
    const [emailingExport, setEmailingExport] = useState(false);
    // Read-only here — the profile's email/Resend key are edited on the
    // Settings page; this page just needs them to know whether "Email CSV"
    // is enabled and what to send it with.
    const [profile, setProfile] = useState<Profile | null>(null);

    const refreshDepartments = async (selectID?: number) => {
        const deps = await getDepartments();
        setDepartments(deps);
        if (selectID != null) setDepartmentID(selectID);
        else if (departmentID == null && deps.length > 0) setDepartmentID(deps[0].departmentID);
    };

    const refreshStudents = async (deptID: number) => {
        setStudents(await getStudentsByDepartment(deptID));
    };

    useEffect(() => {
        refreshDepartments();
        getProfile().then(setProfile);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (departmentID != null) refreshStudents(departmentID);
    }, [departmentID]);

    // object URLs for student thumbnails — rebuilt only when the roster actually changes
    useEffect(() => {
        const urls: Record<number, string> = {};
        students.forEach((s) => {
            if (s.photo) urls[s.studentID] = URL.createObjectURL(s.photo);
        });
        setPhotoUrls(urls);
        return () => {
            Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
        };
    }, [students]);

    const handleAddDepartment = async () => {
        const name = newDept.name.trim();
        if (!name) return;
        try {
            const id = await addDepartment({
                name,
                courseCode: newDept.courseCode.trim(),
                level: newDept.level.trim(),
                group: newDept.group.trim(),
                academicYear: newDept.academicYear.trim(),
                teacherName: newDept.teacherName.trim(),
            });
            setNewDept(emptyDeptForm);
            await refreshDepartments(id);
        } catch {
            alert("Couldn't add course. Please try again.");
        }
    };

    const openEditDepartment = (d: Department) => {
        setDeptFormMode({ type: "edit", departmentID: d.departmentID });
        setDeptForm({
            name: d.name,
            courseCode: d.courseCode,
            level: d.level,
            group: d.group,
            academicYear: d.academicYear,
            teacherName: d.teacherName,
        });
    };

    const openDuplicateDepartment = (d: Department) => {
        setDeptFormMode({ type: "duplicate", sourceDepartmentID: d.departmentID });
        setDeptForm({
            name: `${d.name} (copy)`,
            courseCode: d.courseCode,
            level: d.level,
            group: d.group,
            academicYear: d.academicYear,
            teacherName: d.teacherName,
        });
    };

    const handleSaveDeptForm = async () => {
        if (!deptFormMode) return;
        const name = deptForm.name.trim();
        if (!name) return;
        const payload: DepartmentInput = {
            name,
            courseCode: deptForm.courseCode.trim(),
            level: deptForm.level.trim(),
            group: deptForm.group.trim(),
            academicYear: deptForm.academicYear.trim(),
            teacherName: deptForm.teacherName.trim(),
        };

        try {
            if (deptFormMode.type === "edit") {
                await updateDepartment(deptFormMode.departmentID, payload);
                await refreshDepartments(deptFormMode.departmentID);
            } else {
                const newID = await duplicateDepartment(deptFormMode.sourceDepartmentID, payload);
                await refreshDepartments(newID);
            }
            setDeptFormMode(null);
        } catch {
            alert("Couldn't save. Please try again.");
        }
    };

    const handleDeleteDepartment = async (id: number) => {
        if (!confirm("Delete this course and every student + attendance record in it? This can't be undone.")) return;
        await deleteDepartment(id);
        if (departmentID === id) setDepartmentID(null);
        if (deptFormMode && "departmentID" in deptFormMode && deptFormMode.departmentID === id) {
            setDeptFormMode(null);
        }
        await refreshDepartments();
    };

    const handleImportCsv = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || departmentID == null) return;

        setImporting(true);
        try {
            const text = await file.text();
            const rows = parseStudentsCsv(text);

            if (rows.length === 0) {
                alert("No valid rows found. Expected two columns per line: roll no, name.");
                return;
            }

            const result = await bulkAddStudents(departmentID, rows);
            await refreshStudents(departmentID);

            if (result.skipped.length > 0) {
                const preview = result.skipped
                    .slice(0, 5)
                    .map((s) => `Roll ${s.rollNumber || "?"} (${s.name || "no name"}): ${s.reason}`)
                    .join("\n");
                const more = result.skipped.length > 5 ? `\n…and ${result.skipped.length - 5} more` : "";
                alert(`Imported ${result.added} student(s).\n\nSkipped ${result.skipped.length}:\n${preview}${more}`);
            } else {
                alert(`Imported ${result.added} student(s).`);
            }
        } finally {
            setImporting(false);
            if (csvInputRef.current) csvInputRef.current.value = "";
        }
    };

    // "Download" supports CSV/TSV/XLSX (picked via the format dropdown);
    // "Email CSV" always sends CSV specifically, since that's the safest
    // attachment format for a mail client to render/preview inline.

    const currentLetterhead = () => ({
        institution: profile?.institution ?? "",
        department: profile?.department ?? "",
        professorName: profile?.professorName ?? "",
    });

    // Shared by both the download and email actions — fetches the course's
    // attendance data and builds a filesystem-safe filename base, or returns
    // null (after alerting) if there's nothing to export yet.
    const loadExportData = async () => {
        if (departmentID == null) return null;

        const data = await getDepartmentAttendanceExport(departmentID);
        if (!data || data.sessions.length === 0) {
            alert("No finished sessions yet for this course — nothing to export.");
            return null;
        }

        const safeName = data.department.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "attendance";
        return { data, safeName };
    };

    const handleExportCsv = async () => {
        setExporting(true);
        try {
            const loaded = await loadExportData();
            if (!loaded) return;
            const { data, safeName } = loaded;
            const letterhead = currentLetterhead();

            let blob: Blob;
            let filename: string;
            if (exportFormat === "xlsx") {
                blob = buildAttendanceExportXlsx(data, letterhead);
                filename = `${safeName}_attendance.xlsx`;
            } else if (exportFormat === "tsv") {
                blob = new Blob([buildAttendanceExportTsv(data, letterhead)], {
                    type: "text/tab-separated-values;charset=utf-8;",
                });
                filename = `${safeName}_attendance.tsv`;
            } else {
                blob = new Blob([buildAttendanceExportCsv(data, letterhead)], { type: "text/csv;charset=utf-8;" });
                filename = `${safeName}_attendance.csv`;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    const handleEmailExportCsv = async () => {
        if (!profile?.email) return;

        setEmailingExport(true);
        try {
            const loaded = await loadExportData();
            if (!loaded) return;
            const { data, safeName } = loaded;
            const csv = buildAttendanceExportCsv(data, currentLetterhead());
            const filename = `${safeName}_attendance.csv`;

            const res = await fetch("/api/send-attendance-export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: profile.email,
                    subject: `Attendance export — ${data.department.name}`,
                    filename,
                    csv,
                    apiKey: profile.resendApiKey || undefined,
                    from: profile.resendFromEmail || undefined,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to send email");
            }

            alert(`Sent to ${profile.email}.`);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Couldn't send the email. Please try again.");
        } finally {
            setEmailingExport(false);
        }
    };

    const handleAddStudent = async () => {
        if (departmentID == null) return;
        const rollNumber = Number(newStudent.rollNumber);
        const name = newStudent.name.trim();
        if (!rollNumber || !name) return;

        try {
            await addStudent({ departmentID, rollNumber, name, photo: newPhoto });
        } catch {
            alert(`Couldn't add student — roll number ${rollNumber} is likely already taken in this course.`);
            return;
        }

        setNewStudent({ rollNumber: "", name: "" });
        setNewPhoto(null);
        if (newPhotoInputRef.current) newPhotoInputRef.current.value = "";
        await refreshStudents(departmentID);
    };

    const handleDeleteStudent = async (studentID: number) => {
        if (!confirm("Remove this student and their attendance history?")) return;
        await deleteStudent(studentID);
        if (departmentID != null) await refreshStudents(departmentID);
    };

    const handlePhotoChange = async (studentID: number, e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || departmentID == null) return;
        await updateStudent(studentID, { photo: file });
        await refreshStudents(departmentID);
    };

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title="Manage Courses" />

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-6">
                {/* ---------------- Courses ---------------- */}
                <section>
                    <h2 className="mb-3 text-lg font-semibold text-card-foreground">Courses</h2>

                    <div className="flex flex-wrap gap-2">
                        {departments.map((d) => (
                            <div
                                key={d.departmentID}
                                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${departmentID === d.departmentID
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-card text-muted-foreground"
                                    }`}
                            >
                                <button type="button" onClick={() => setDepartmentID(d.departmentID)}>
                                    {d.name}
                                    {d.level && <span className="ml-1 opacity-70">({d.level})</span>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openEditDepartment(d)}
                                    className="text-muted-foreground hover:text-card-foreground"
                                    aria-label={`Edit ${d.name}`}
                                >
                                    ✎
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openDuplicateDepartment(d)}
                                    className="text-muted-foreground hover:text-card-foreground"
                                    aria-label={`Duplicate ${d.name}`}
                                    title="Duplicate this course (same students & photos) — e.g. for a new semester"
                                >
                                    ⧉
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteDepartment(d.departmentID)}
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label={`Delete ${d.name}`}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Subject</label>
                            <input
                                value={newDept.name}
                                onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Data Structures"
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Course Code</label>
                            <input
                                value={newDept.courseCode}
                                onChange={(e) => setNewDept((p) => ({ ...p, courseCode: e.target.value }))}
                                placeholder="CSC 205"
                                className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Level (Year/Sem)</label>
                            <input
                                value={newDept.level}
                                onChange={(e) => setNewDept((p) => ({ ...p, level: e.target.value }))}
                                placeholder="3/2"
                                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Group</label>
                            <input
                                value={newDept.group}
                                onChange={(e) => setNewDept((p) => ({ ...p, group: e.target.value }))}
                                placeholder="A"
                                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Academic Year</label>
                            <input
                                value={newDept.academicYear}
                                onChange={(e) => setNewDept((p) => ({ ...p, academicYear: e.target.value }))}
                                placeholder="2082/083"
                                className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Teacher</label>
                            <input
                                value={newDept.teacherName}
                                onChange={(e) => setNewDept((p) => ({ ...p, teacherName: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                                placeholder="Teacher's name"
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAddDepartment}
                            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
                        >
                            Add course
                        </button>
                    </div>

                    {/* Edit / Duplicate panel — shared by both actions, only one open at a time */}
                    {deptFormMode && (
                        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-end">
                            <p className="w-full text-xs font-medium text-primary">
                                {deptFormMode.type === "edit" ? "Edit course" : "Duplicate course — same students & photos"}
                            </p>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Subject</label>
                                <input
                                    value={deptForm.name}
                                    onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
                                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Course Code</label>
                                <input
                                    value={deptForm.courseCode}
                                    onChange={(e) => setDeptForm((p) => ({ ...p, courseCode: e.target.value }))}
                                    placeholder="CSC 205"
                                    className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Level (Year/Sem)</label>
                                <input
                                    value={deptForm.level}
                                    onChange={(e) => setDeptForm((p) => ({ ...p, level: e.target.value }))}
                                    placeholder="3/2"
                                    className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Group</label>
                                <input
                                    value={deptForm.group}
                                    onChange={(e) => setDeptForm((p) => ({ ...p, group: e.target.value }))}
                                    placeholder="A"
                                    className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Academic Year</label>
                                <input
                                    value={deptForm.academicYear}
                                    onChange={(e) => setDeptForm((p) => ({ ...p, academicYear: e.target.value }))}
                                    placeholder="2082/083"
                                    className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Teacher</label>
                                <input
                                    value={deptForm.teacherName}
                                    onChange={(e) => setDeptForm((p) => ({ ...p, teacherName: e.target.value }))}
                                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveDeptForm}
                                    className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
                                >
                                    {deptFormMode.type === "edit" ? "Save" : "Create copy"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeptFormMode(null)}
                                    className="rounded-lg border border-border bg-card px-4 py-1.5 text-sm font-semibold text-card-foreground"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* ---------------- Students ---------------- */}
                {departmentID != null && (
                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-card-foreground">Students</h2>
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={exportFormat}
                                    onChange={(e) => setExportFormat(e.target.value as "csv" | "tsv" | "xlsx")}
                                    className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-card-foreground"
                                    aria-label="Download format"
                                >
                                    <option value="csv">CSV</option>
                                    <option value="tsv">TSV</option>
                                    <option value="xlsx">XLSX</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={handleExportCsv}
                                    disabled={exporting}
                                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-card-foreground hover:bg-accent disabled:opacity-50"
                                >
                                    {exporting ? "Exporting…" : "Download"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleEmailExportCsv}
                                    disabled={emailingExport || !profile?.email}
                                    title={
                                        profile?.email
                                            ? `Email to ${profile.email}`
                                            : "Add an email in your profile (Customize) to enable this"
                                    }
                                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-card-foreground hover:bg-accent disabled:opacity-50"
                                >
                                    {emailingExport ? "Sending…" : "Email CSV"}
                                </button>
                                <label className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-card-foreground hover:bg-accent">
                                    {importing ? "Importing…" : "Import CSV"}
                                    <input
                                        ref={csvInputRef}
                                        type="file"
                                        accept=".csv,text/csv"
                                        className="hidden"
                                        disabled={importing}
                                        onChange={handleImportCsv}
                                    />
                                </label>
                            </div>
                        </div>
                        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                            Import: two columns per row, roll no, name (header row optional). Export: roll no, name,
                            one column per finished session (P/A), total attendance, total classes, percentage.
                            Pick CSV/TSV/XLSX before downloading — XLSX opens directly in Excel/Sheets/WPS on
                            mobile. &quot;Email CSV&quot; always sends a .csv attachment regardless of the dropdown,
                            to the email in your profile — manage your Resend key on the{" "}
                            <a href="/settings" className="underline">
                                Settings
                            </a>{" "}
                            page.
                        </p>

                        <div className="overflow-hidden rounded-2xl border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-left text-muted-foreground">
                                    <tr>
                                        <th className="w-16 px-4 py-2">Photo</th>
                                        <th className="w-20 px-4 py-2">Roll No.</th>
                                        <th className="px-4 py-2">Name</th>
                                        <th className="w-12 px-4 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((s) => (
                                        <tr key={s.studentID} className="border-t border-border">
                                            <td className="px-4 py-2">
                                                <label className="block cursor-pointer">
                                                    {photoUrls[s.studentID] ? (
                                                        <img
                                                            src={photoUrls[s.studentID]}
                                                            alt={s.name}
                                                            className="h-10 w-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                                                            +
                                                        </span>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => handlePhotoChange(s.studentID, e)}
                                                    />
                                                </label>
                                            </td>
                                            <td className="px-4 py-2 tabular-nums">{s.rollNumber}</td>
                                            <td className="px-4 py-2">{s.name}</td>
                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteStudent(s.studentID)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                    aria-label={`Delete ${s.name}`}
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* add-student row */}
                                    <tr className="border-t border-border bg-muted/40">
                                        <td className="px-4 py-2">
                                            <label className="block cursor-pointer">
                                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                                                    {newPhoto ? "✓" : "+"}
                                                </span>
                                                <input
                                                    ref={newPhotoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
                                                />
                                            </label>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                value={newStudent.rollNumber}
                                                onChange={(e) => setNewStudent((p) => ({ ...p, rollNumber: e.target.value }))}
                                                placeholder="#"
                                                inputMode="numeric"
                                                className="w-16 rounded-lg border border-border bg-card px-2 py-1"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                value={newStudent.name}
                                                onChange={(e) => setNewStudent((p) => ({ ...p, name: e.target.value }))}
                                                onKeyDown={(e) => e.key === "Enter" && handleAddStudent()}
                                                placeholder="Student name"
                                                className="w-full rounded-lg border border-border bg-card px-2 py-1"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={handleAddStudent}
                                                className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                                            >
                                                Add
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}