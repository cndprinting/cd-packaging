import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

let graphClient: Client | null = null;

export function getGraphClient(): Client | null {
  if (graphClient) return graphClient;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn("Azure credentials not configured — email sending disabled");
    return null;
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  graphClient = Client.initWithMiddleware({ authProvider });
  return graphClient;
}

export interface SendEmailOptions {
  from: string; // sender email (must be a C&D M365 mailbox)
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string; // HTML content
  attachments?: { name: string; contentType: string; base64Content: string }[];
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const client = getGraphClient();
  if (!client) {
    return { success: false, error: "Email not configured — Azure credentials missing" };
  }

  const toRecipients = (Array.isArray(options.to) ? options.to : [options.to]).map((email) => ({
    emailAddress: { address: email },
  }));

  const ccRecipients = options.cc
    ? (Array.isArray(options.cc) ? options.cc : [options.cc]).map((email) => ({
        emailAddress: { address: email },
      }))
    : [];

  const bccRecipients = options.bcc
    ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map((email) => ({
        emailAddress: { address: email },
      }))
    : [];

  const message: Record<string, unknown> = {
    subject: options.subject,
    body: { contentType: "HTML", content: options.body },
    toRecipients,
    ccRecipients,
    bccRecipients,
  };

  if (options.attachments?.length) {
    message.attachments = options.attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.base64Content,
    }));
  }

  try {
    await client.api(`/users/${options.from}/sendMail`).post({ message, saveToSentItems: true });
    return { success: true };
  } catch (error: any) {
    console.error("Graph sendMail error:", error.message || error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

const toRecips = (v?: string | string[]) => (v ? (Array.isArray(v) ? v : [v]) : []).map((address) => ({ emailAddress: { address } }));

// Send via a draft so we can capture the conversationId — lets later emails to
// the same customer thread into one conversation.
// A document attachment worth carrying (Mary's quote PDF, customer artwork).
// We keep real file attachments, and — critically — do NOT drop them just
// because Outlook flagged them isInline, which it often does to a PDF. We only
// exclude inline items that are clearly embedded images (logos in a signature)
// (Benjy 8/13 — a customer got a "see attached" quote with no attachment).
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|ai|eps|zip|csv|txt)$/i;
function isKeepAttachment(a: any): boolean {
  if (a["@odata.type"] !== "#microsoft.graph.fileAttachment") return false;
  if (!a.isInline) return true;                       // normal attachment
  if (DOC_EXT.test(a.name || "")) return true;        // inline-flagged but a real doc (PDF etc.)
  return false;                                        // inline image → skip
}

export async function sendEmailGetConversation(options: SendEmailOptions & { copyAttachmentsFrom?: string }): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const client = getGraphClient();
  if (!client) return { success: false, error: "Email not configured" };
  try {
    const draft: any = await client.api(`/users/${options.from}/messages`).post({
      subject: options.subject,
      body: { contentType: "HTML", content: options.body },
      toRecipients: toRecips(options.to),
      ccRecipients: toRecips(options.cc),
      bccRecipients: toRecips(options.bcc),
    });
    // Carry over file attachments (e.g. Mary's quote PDF) onto this first email.
    if (options.copyAttachmentsFrom) {
      try {
        const atts: any = await client.api(`/users/${options.from}/messages/${options.copyAttachmentsFrom}/attachments`).get();
        for (const a of (atts.value || [])) {
          if (isKeepAttachment(a)) {
            await client.api(`/users/${options.from}/messages/${draft.id}/attachments`).post({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.contentType, contentBytes: a.contentBytes });
          }
        }
      } catch { /* attachment copy is best-effort */ }
    }
    await client.api(`/users/${options.from}/messages/${draft.id}/send`).post({});
    return { success: true, conversationId: draft.conversationId };
  } catch (error: any) {
    console.error("Graph sendEmailGetConversation error:", error.message || error);
    return { success: false, error: error.message || "Failed" };
  }
}

// Pull the first real (non-inline) PDF attachment's bytes from a message.
export async function getFirstPdfAttachment(from: string, messageId: string): Promise<{ name: string; contentType: string; contentBytes: string } | null> {
  const client = getGraphClient();
  if (!client) return null;
  try {
    const atts: any = await client.api(`/users/${from}/messages/${messageId}/attachments`).get();
    const files = (atts.value || []).filter(isKeepAttachment);
    const pdf = files.find((a: any) => /pdf$/i.test(a.name || "")) || files[0];
    if (!pdf) return null;
    return { name: pdf.name, contentType: pdf.contentType, contentBytes: pdf.contentBytes };
  } catch (error: any) {
    console.error("Graph getFirstPdfAttachment error:", error.message || error);
    return null;
  }
}

// Forward a message (keeping its attachments) to new recipients with a note.
export async function forwardMessage(options: { from: string; messageId: string; to: string | string[]; cc?: string | string[]; comment?: string }): Promise<{ success: boolean; error?: string }> {
  const client = getGraphClient();
  if (!client) return { success: false, error: "Email not configured" };
  try {
    const draft: any = await client.api(`/users/${options.from}/messages/${options.messageId}/createForward`).post({ comment: options.comment || "", toRecipients: toRecips(options.to) });
    if (options.cc) await client.api(`/users/${options.from}/messages/${draft.id}`).patch({ ccRecipients: toRecips(options.cc) });
    await client.api(`/users/${options.from}/messages/${draft.id}/send`).post({});
    return { success: true };
  } catch (error: any) {
    console.error("Graph forwardMessage error:", error.message || error);
    return { success: false, error: error.message || "Failed" };
  }
}

// Reply inside an existing conversation so the email stays in the same thread.
// We reply to one of our own messages in the thread and override the recipients.
export async function replyInConversation(options: { from: string; conversationId: string; to: string | string[]; cc?: string | string[]; bcc?: string | string[]; body: string; copyAttachmentsFrom?: string }): Promise<{ success: boolean; error?: string }> {
  const client = getGraphClient();
  if (!client) return { success: false, error: "Email not configured" };
  try {
    const found: any = await client.api(`/users/${options.from}/messages`).filter(`conversationId eq '${options.conversationId}'`).select("id").top(1).get();
    const src = (found.value || [])[0];
    if (!src) return { success: false, error: "conversation not found" };
    const reply: any = await client.api(`/users/${options.from}/messages/${src.id}/createReply`).post({});
    await client.api(`/users/${options.from}/messages/${reply.id}`).patch({ toRecipients: toRecips(options.to), ccRecipients: toRecips(options.cc), bccRecipients: toRecips(options.bcc), body: { contentType: "HTML", content: options.body } });
    // Carry over file attachments from a source message (e.g. customer artwork → Mary's thread).
    if (options.copyAttachmentsFrom) {
      try {
        const atts: any = await client.api(`/users/${options.from}/messages/${options.copyAttachmentsFrom}/attachments`).get();
        for (const a of (atts.value || [])) {
          if (isKeepAttachment(a)) {
            await client.api(`/users/${options.from}/messages/${reply.id}/attachments`).post({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.contentType, contentBytes: a.contentBytes });
          }
        }
      } catch (e: any) { console.error("copy attachments failed:", e.message || e); }
    }
    await client.api(`/users/${options.from}/messages/${reply.id}/send`).post({});
    return { success: true };
  } catch (error: any) {
    console.error("Graph replyInConversation error:", error.message || error);
    return { success: false, error: error.message || "Failed" };
  }
}
