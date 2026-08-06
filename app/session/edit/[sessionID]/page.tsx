"use client";

import { use } from "react";
import SessionMarkingView from "../../../components/sessionMarkingView";

export default function EditSessionPage({ params }: { params: Promise<{ sessionID: string }> }) {
    const { sessionID: sessionIDParam } = use(params);
    const sessionID = Number(sessionIDParam);

    return <SessionMarkingView sessionID={sessionID} backHref={`/summary/${sessionID}`} />;
}