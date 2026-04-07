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

  const message: Record<string, unknown> = {
    subject: options.subject,
    body: { contentType: "HTML", content: options.body },
    toRecipients,
    ccRecipients,
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
