"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Navbar from "../components/navbar";
import type { Profile } from "../lib/db";
import { getProfile, updateProfile } from "../lib/queries";

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);

    const [nameDraft, setNameDraft] = useState("");
    const [emailDraft, setEmailDraft] = useState("");
    const [institutionDraft, setInstitutionDraft] = useState("");
    const [departmentDraft, setDepartmentDraft] = useState("");
    const [resendKeyDraft, setResendKeyDraft] = useState("");
    const [resendFromDraft, setResendFromDraft] = useState("");

    const [photoDraft, setPhotoDraft] = useState<Blob | null>(null);
    const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [saving, setSaving] = useState(false);

    // One fetch populates every draft on this page — profile info and
    // Resend/email settings used to live in two separate places (a popup on
    // Home, and this page); now they're all edited and saved together here.
    const refresh = async () => {
        const p = await getProfile();
        setProfile(p);
        setNameDraft(p.professorName);
        setEmailDraft(p.email);
        setInstitutionDraft(p.institution);
        setDepartmentDraft(p.department);
        setResendKeyDraft(p.resendApiKey);
        setResendFromDraft(p.resendFromEmail);
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!profile?.photo) {
            setPhotoUrl(null);
            return;
        }
        const url = URL.createObjectURL(profile.photo);
        setPhotoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [profile?.photo]);

    useEffect(() => {
        if (!photoDraft) {
            setPhotoDraftUrl(null);
            return;
        }
        const url = URL.createObjectURL(photoDraft);
        setPhotoDraftUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [photoDraft]);

    const handlePhotoPick = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setPhotoDraft(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile({
                professorName: nameDraft.trim(),
                email: emailDraft.trim(),
                institution: institutionDraft.trim(),
                department: departmentDraft.trim(),
                resendApiKey: resendKeyDraft.trim(),
                resendFromEmail: resendFromDraft.trim(),
                ...(photoDraft ? { photo: photoDraft } : {}),
            });
            setPhotoDraft(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            await refresh();
        } finally {
            setSaving(false);
        }
    };

    const displayPhotoUrl = photoDraftUrl ?? photoUrl;

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title="Settings" />

            <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
                {/* ---------------- Profile & Email (one combined section) ---------------- */}
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-card-foreground">Profile &amp; Email</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Shown on the Home screen, and used across every course&apos;s attendance reports and
                        exports.
                    </p>

                    <div className="mt-5 flex flex-col items-center gap-2">
                        <label className="cursor-pointer">
                            <div className="aspect-[4/3] w-40 overflow-hidden rounded-2xl border border-border bg-muted">
                                {displayPhotoUrl ? (
                                    <img src={displayPhotoUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
                                        👤
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoPick}
                            />
                            <p className="mt-1 text-center text-xs text-muted-foreground">Tap to change photo</p>
                        </label>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Name</label>
                            <input
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                placeholder="Professor's name"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Shown as the teacher on every course&apos;s attendance report — courses don&apos;t
                                have their own teacher field.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Email</label>
                            <input
                                type="email"
                                value={emailDraft}
                                onChange={(e) => setEmailDraft(e.target.value)}
                                placeholder="you@example.com"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Used for the &quot;Email Report&quot; option when exporting attendance.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Institution</label>
                            <input
                                value={institutionDraft}
                                onChange={(e) => setInstitutionDraft(e.target.value)}
                                placeholder="e.g. Institute of Forestry"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Department</label>
                            <input
                                value={departmentDraft}
                                onChange={(e) => setDepartmentDraft(e.target.value)}
                                placeholder="e.g. Forest Science"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-1 sm:col-span-2">
                            <label className="text-xs text-muted-foreground">Resend API Key</label>
                            <input
                                type="password"
                                value={resendKeyDraft}
                                onChange={(e) => setResendKeyDraft(e.target.value)}
                                placeholder="re_xxxxxxxxxxxx"
                                autoComplete="off"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Enables the &quot;Email Report&quot; button when exporting attendance — no server
                                setup needed. Get a key at{" "}
                                <a
                                    href="https://resend.com/api-keys"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                >
                                    resend.com/api-keys
                                </a>
                                .{" "}
                                {profile?.resendApiKey
                                    ? "A key is saved on this device."
                                    : "No key saved yet — without one, Email Report falls back to the server's RESEND_API_KEY, if set."}
                            </p>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-muted-foreground">
                        The Resend key is stored locally in this browser and only sent to this app&apos;s own
                        server when you press Email Report, never to any third party besides Resend itself.
                    </p>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto sm:px-8"
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                </section>
            </div>
        </main>
    );
}