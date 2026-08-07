import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "../../lib/email";

export async function POST(req: NextRequest) {
    let body: { to?: string; subject?: string; filename?: string; csv?: string; apiKey?: string; from?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { to, subject, filename, csv, apiKey, from } = body;

    if (!to || typeof to !== "string" || !to.includes("@")) {
        return NextResponse.json({ error: "Missing or invalid recipient email" }, { status: 400 });
    }
    if (!csv || typeof csv !== "string") {
        return NextResponse.json({ error: "Missing CSV content" }, { status: 400 });
    }

    try {
        await sendEmail({
            to,
            subject: subject?.trim() || "Attendance export",
            text: "Attached is the attendance export from Hajiri.",
            attachments: [
                {
                    filename: filename?.trim() || "attendance.csv",
                    content: Buffer.from(csv, "utf-8").toString("base64"),
                },
            ],
            apiKey,
            from,
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Failed to send attendance export email:", err);
        const message = err instanceof Error ? err.message : "Failed to send email";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}