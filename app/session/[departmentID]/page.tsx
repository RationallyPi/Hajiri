"use client";

import { use, useEffect, useState } from "react";
import SessionMarkingView from "../../components/sessionMarkingView";
import { getOrCreateActiveSession } from "../../lib/queries";

export default function SessionPage({ params }: { params: Promise<{ departmentID: string }> }) {
    const { departmentID: departmentIDParam } = use(params);
    const departmentID = Number(departmentIDParam);
    const [sessionID, setSessionID] = useState<number | null>(null);

    useEffect(() => {
        getOrCreateActiveSession(departmentID).then((session) => setSessionID(session.sessionID));
    }, [departmentID]);

    if (sessionID == null) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background">
                <p className="text-muted-foreground">Loading…</p>
            </main>
        );
    }

    return <SessionMarkingView sessionID={sessionID} />;
}