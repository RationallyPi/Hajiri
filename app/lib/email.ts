
import { Resend } from "resend";

type SendPayload = Parameters<InstanceType<typeof Resend>["emails"]["send"]>[0];

const DEFAULT_FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "Hajiri <onboarding@resend.dev>";

export interface EmailAttachment {
    filename: string;
    /** Base64-encoded file contents. */
    content: string;
}

export interface SendEmailInput {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    /** Overrides RESEND_API_KEY for this call. */
    apiKey?: string;
    /** Overrides RESEND_FROM_EMAIL for this call. */
    from?: string;
}

// Thin wrapper around Resend's `emails.send` — generic enough to reuse for
// any transactional email the app needs (not just attendance exports).
// Throws on failure so callers (route handlers) can turn it into a proper
// HTTP error response.
export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
    const { to, subject, text, html, attachments, apiKey, from } = input;

    const key = apiKey?.trim() || process.env.RESEND_API_KEY;
    if (!key) {
        throw new Error(
            "No Resend API key available — paste one in Settings > Email, or set RESEND_API_KEY on the server.",
        );
    }
    if (!text && !html) {
        throw new Error("sendEmail requires `text` or `html` content.");
    }

    const resend = new Resend(key);

    // Built without any explicitly-undefined keys — the SDK's CreateEmailOptions
    // is a union (template email vs. content email) and a key present-but-undefined
    // (e.g. `text: undefined`) fails to match either branch cleanly.
    const payload: SendPayload = {
        from: from?.trim() || DEFAULT_FROM_ADDRESS,
        to,
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
        ...(attachments ? { attachments } : {}),
    } as SendPayload;

    const { data, error } = await resend.emails.send(payload);

    if (error) {
        console.error("Resend error:", error); // TEMP — see the real cause in your server logs
        throw new Error(error.message || JSON.stringify(error) || "Failed to send email via Resend");
    }

    return { id: data?.id ?? "" };
}