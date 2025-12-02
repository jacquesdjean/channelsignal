export interface InboundEmailPayload {
  // Common fields supported by most inbound email providers (Resend, Postmark, etc.)
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  sentAt?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string; // base64
  }>;
}

export interface ParsedEmail {
  messageId: string;
  threadId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  sentAt: Date;
  bccRecipient: string | null;
}

export interface ExtractedContact {
  email: string;
  name: string | null;
  domain: string | null;
}
