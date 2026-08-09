"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Profile } from "../lib/db";
import { getProfile } from "../lib/queries";

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
// History icon) — a Context is what lets both read the same fetch without
// page.tsx having to wire props between them.
//
// Editing itself no longer happens here — it used to be a popup with its
// own copy of every profile field, which duplicated what's now on the
// Settings page's combined "Profile & Email" section. This component is
// display-only; CustomizeButton just links there instead.
interface ProfileContextValue {
    profile: Profile | null;
    photoUrl: string | null;
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

    useEffect(() => {
        getProfile().then(setProfile);
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

    return <ProfileContext.Provider value={{ profile, photoUrl }}>{children}</ProfileContext.Provider>;
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
            <p className="text-sm font-medium text-card-foreground">{profile?.professorName || "Set your profile through Settings"}</p>
        </div>
    );
}

// Icon button meant to sit alongside the History/Settings icons — links to
// the Settings page's "Profile & Email" section, where photo/name/email/
// institution/department and the Resend email settings are all edited
// together in one place.
export function CustomizeButton() {
    return (
        <Link
            href="/settings"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Edit profile in Settings"
        >
            <CustomizeIcon />
        </Link>
    );
}