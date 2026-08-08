"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/navbar";
import type { Profile } from "../lib/db";
import { getProfile, updateProfile } from "../lib/queries";

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [resendKeyDraft, setResendKeyDraft] = useState("");
    const [resendFromDraft, setResendFromDraft] = useState("");
    const [savingEmailSettings, setSavingEmailSettings] = useState(false);

    useEffect(() => {
        getProfile().then((p) => {
            setProfile(p);
            setResendKeyDraft(p.resendApiKey);
            setResendFromDraft(p.resendFromEmail);
        });
    }, []);

    const handleSaveEmailSettings = async () => {
        setSavingEmailSettings(true);
        try {
            await updateProfile({
                resendApiKey: resendKeyDraft.trim(),
                resendFromEmail: resendFromDraft.trim(),
            });
            setProfile(await getProfile());
        } finally {
            setSavingEmailSettings(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <Navbar title="Settings" />

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-6">
                {/* ---------------- Email (Resend) ---------------- */}
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-card-foreground">Email</h2>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Paste in a Resend API key to enable the &quot;Email Report&quot; button when exporting
                        attendance from{" "}
                        <a href="/courses" className="underline">
                            Manage Courses
                        </a>{" "}
                        — no server setup needed. Get a key at{" "}
                        <a
                            href="https://resend.com/api-keys"
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                        >
                            resend.com/api-keys
                        </a>
                        .
                    </p>

                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Resend API Key</label>
                            <input
                                type="password"
                                value={resendKeyDraft}
                                onChange={(e) => setResendKeyDraft(e.target.value)}
                                placeholder="re_xxxxxxxxxxxx"
                                autoComplete="off"
                                className="w-64 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveEmailSettings}
                            disabled={savingEmailSettings}
                            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                            {savingEmailSettings ? "Saving…" : "Save"}
                        </button>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                        {profile?.resendApiKey
                            ? "A key is saved on this device."
                            : "No key saved yet — without one, Email Report falls back to the server's RESEND_API_KEY, if set."}{" "}
                        The key is stored locally in this browser and only sent to this app's own server when you
                        press Email Report, never to any third party besides Resend itself.
                    </p>

                    {!profile?.email && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            You&apos;ll also need an email on your profile — set it via{" "}
                            <span className="font-medium">Customize</span> on the Home screen.
                        </p>
                    )}
                </section>
            </div>
        </main>
    );
}