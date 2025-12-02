import { InboundEmailPayload, ParsedEmail, ExtractedContact } from './types';

// Common personal email domains to skip when creating orgs
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'tutanota.com',
  'fastmail.com',
  'zoho.com',
]);

/**
 * Parses an email address string like "John Doe <john@example.com>" or "john@example.com"
 */
export function parseEmailAddress(address: string): { email: string; name: string | null } {
  const match = address.match(/^(?:"?([^"<]+)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2].toLowerCase().trim(),
    };
  }
  return {
    name: null,
    email: address.toLowerCase().trim(),
  };
}

/**
 * Extracts the domain from an email address
 */
export function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length === 2) {
    return parts[1].toLowerCase();
  }
  return null;
}

/**
 * Checks if a domain is a personal email domain
 */
export function isPersonalDomain(domain: string | null): boolean {
  if (!domain) return true;
  return PERSONAL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Extracts thread ID from email headers (In-Reply-To or References)
 */
export function extractThreadId(headers: Record<string, string> | undefined): string | null {
  if (!headers) return null;

  // Try In-Reply-To first (most specific)
  if (headers['in-reply-to']) {
    return headers['in-reply-to'].replace(/[<>]/g, '');
  }

  // Fall back to References (take the first one)
  if (headers['references']) {
    const refs = headers['references'].split(/\s+/);
    if (refs.length > 0) {
      return refs[0].replace(/[<>]/g, '');
    }
  }

  return null;
}

/**
 * Parses the raw inbound email payload into a normalized format
 */
export function parseInboundEmail(payload: InboundEmailPayload): ParsedEmail {
  const from = parseEmailAddress(payload.from);

  // Find BCC recipient (our app's address)
  const bccRecipient = payload.bcc?.find(addr => {
    const parsed = parseEmailAddress(addr);
    return parsed.email.startsWith('u_') && parsed.email.includes('@in.');
  }) || null;

  return {
    messageId: payload.messageId,
    threadId: extractThreadId(payload.headers),
    fromAddress: from.email,
    fromName: from.name,
    toAddresses: payload.to.map(addr => parseEmailAddress(addr).email),
    ccAddresses: payload.cc?.map(addr => parseEmailAddress(addr).email) || [],
    subject: payload.subject,
    textBody: payload.textBody || null,
    htmlBody: payload.htmlBody || null,
    sentAt: payload.sentAt ? new Date(payload.sentAt) : new Date(),
    bccRecipient: bccRecipient ? parseEmailAddress(bccRecipient).email : null,
  };
}

/**
 * Extracts all contacts from an email (from, to, cc)
 */
export function extractContacts(payload: InboundEmailPayload): ExtractedContact[] {
  const contacts: Map<string, ExtractedContact> = new Map();

  // Add sender
  const from = parseEmailAddress(payload.from);
  const fromDomain = extractDomain(from.email);
  contacts.set(from.email, {
    email: from.email,
    name: from.name,
    domain: fromDomain,
  });

  // Add To recipients
  for (const addr of payload.to) {
    const parsed = parseEmailAddress(addr);
    // Skip our BCC address
    if (parsed.email.startsWith('u_') && parsed.email.includes('@in.')) {
      continue;
    }
    if (!contacts.has(parsed.email)) {
      contacts.set(parsed.email, {
        email: parsed.email,
        name: parsed.name,
        domain: extractDomain(parsed.email),
      });
    }
  }

  // Add CC recipients
  for (const addr of payload.cc || []) {
    const parsed = parseEmailAddress(addr);
    if (parsed.email.startsWith('u_') && parsed.email.includes('@in.')) {
      continue;
    }
    if (!contacts.has(parsed.email)) {
      contacts.set(parsed.email, {
        email: parsed.email,
        name: parsed.name,
        domain: extractDomain(parsed.email),
      });
    }
  }

  return Array.from(contacts.values());
}

// Meeting-related keywords for classification
const MEETING_PATTERNS = [
  /\bqbr\b/i,
  /\bquarterly\s+business\s+review\b/i,
  /\bannual\s+review\b/i,
  /\byearly\s+review\b/i,
  /\bweekly\s+(sync|check-?in|meeting|call)\b/i,
  /\bmonthly\s+(sync|check-?in|meeting|call)\b/i,
  /\bdeal\s+review\b/i,
  /\bpipeline\s+review\b/i,
];

export type MeetingClassification = 'QBR' | 'ANNUAL_REVIEW' | 'WEEKLY_CHECKIN' | 'DEAL_REVIEW' | 'OTHER' | null;

/**
 * Attempts to classify an email as a meeting invite based on subject
 */
export function classifyMeeting(subject: string): MeetingClassification {
  const subjectLower = subject.toLowerCase();

  if (/\bqbr\b/i.test(subject) || /quarterly\s+business\s+review/i.test(subject)) {
    return 'QBR';
  }

  if (/annual\s+review/i.test(subject) || /yearly\s+review/i.test(subject)) {
    return 'ANNUAL_REVIEW';
  }

  if (/weekly\s+(sync|check-?in|meeting|call)/i.test(subject)) {
    return 'WEEKLY_CHECKIN';
  }

  if (/deal\s+review/i.test(subject) || /pipeline\s+review/i.test(subject)) {
    return 'DEAL_REVIEW';
  }

  // Check if any meeting pattern matches
  for (const pattern of MEETING_PATTERNS) {
    if (pattern.test(subject)) {
      return 'OTHER';
    }
  }

  return null;
}
