"use client";

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type ReactNode,
} from "react";
import type { Profile } from "../lib/db";
import { getProfile, updateProfile } from "../lib/queries";

// A generic "customize / adjustments" glyph — sliders icon, drawn inline so
// this component has no icon-library dependency.
function CustomizeIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
        >
            <line x1="4" y1="6" x2="20" y2="6" />
            <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
    );
}

// Shared between ProfileDisplay (photo + name, wherever it's placed) and
// CustomizeButton (which can sit somewhere else entirely, e.g. next to the
// History icon) — a Context is what lets both stay in sync with one fetch
// and one edit modal, without page.tsx having to wire props between them.
interface ProfileContextValue {
    profile: Profile | null;
    photoUrl: string | null;
    openEditor: () => void;
}
const ProfileContext = createContext<ProfileContextValue | null>(null);

function useProfileContext() {
    const ctx = useContext(ProfileContext);
    if (!ctx) throw new Error("ProfileDisplay/CustomizeButton must be used inside <ProfileProvider>");
    return ctx;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [emailDraft, setEmailDraft] = useState("");
    const [institutionDraft, setInstitutionDraft] = useState("");
    const [departmentDraft, setDepartmentDraft] = useState("");
    const [photoDraft, setPhotoDraft] = useState<Blob | null>(null);
    const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refresh = async () => setProfile(await getProfile());

    useEffect(() => {
        refresh();
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

    const openEditor = () => {
        setNameDraft(profile?.professorName ?? "");
        setEmailDraft(profile?.email ?? "");
        setInstitutionDraft(profile?.institution ?? "");
        setDepartmentDraft(profile?.department ?? "");
        setPhotoDraft(null);
        setEditing(true);
    };

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
                ...(photoDraft ? { photo: photoDraft } : {}),
            });
            await refresh();
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const displayUrl = photoDraftUrl ?? photoUrl;

    return (
        <ProfileContext.Provider value={{ profile, photoUrl, openEditor }}>
            {children}

            {editing && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => !saving && setEditing(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-card-foreground">Customize profile</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Shown at the top of the Home screen.
                        </p>

                        <div className="mt-4 flex flex-col items-center gap-2">
                            <label className="cursor-pointer">
                                <div className="aspect-[4/3] w-40 overflow-hidden rounded-2xl border border-border bg-muted">
                                    {displayUrl ? (
                                        <img src={displayUrl} alt="" className="h-full w-full object-cover" />
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

                        <div className="mt-4 flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Name</label>
                            <input
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                placeholder="Professor's name"
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Shown as the teacher on every course&apos;s attendance report — courses no longer
                                have their own teacher field.
                            </p>
                        </div>

                        <div className="mt-3 flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Email</label>
                            <input
                                type="email"
                                value={emailDraft}
                                onChange={(e) => setEmailDraft(e.target.value)}
                                placeholder="you@example.com"
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Used for the &quot;Email Report&quot; option when exporting attendance.
                            </p>
                        </div>

                        <div className="mt-3 flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Institution</label>
                            <input
                                value={institutionDraft}
                                onChange={(e) => setInstitutionDraft(e.target.value)}
                                placeholder="e.g. Institute of Forestry"
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>

                        <div className="mt-3 flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Department</label>
                            <input
                                value={departmentDraft}
                                onChange={(e) => setDepartmentDraft(e.target.value)}
                                placeholder="e.g. Forest Science"
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                            />
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setEditing(false)}
                                disabled={saving}
                                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-card-foreground disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ProfileContext.Provider>
    );
}

// Photo + name, meant to sit above the "Hajiri" title.
export function ProfileDisplay() {
    const { profile, photoUrl } = useProfileContext();

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="aspect-[4/3] w-40 overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
                {photoUrl ? (
                    <img src={photoUrl} alt={profile?.professorName || "Profile"} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
                        👤
                    </div>
                )}
            </div>
            <p className="text-sm font-medium text-card-foreground">{profile?.professorName || "Add your name"}</p>
        </div>
    );
}

// Icon button meant to sit alongside the History/Settings icons.
export function CustomizeButton() {
    const { openEditor } = useProfileContext();

    return (
        <button
            type="button"
            onClick={openEditor}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Customize profile"
        >
            <CustomizeIcon />
        </button>
    );
}