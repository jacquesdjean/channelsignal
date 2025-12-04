/**
 * Email parsing utilities for extracting deal information.
 */

import type { Deal, DealContact, CurrencyCode } from '../types/channelsignal';

/**
 * Regex patterns for extracting financial amounts.
 */
const AMOUNT_PATTERNS = {
  // Matches $1,234.56 or $1234.56 or $1,234
  USD: /\$[\d,]+(?:\.\d{2})?/g,
  // Matches €1.234,56 or €1234,56 or €1.234 (European format)
  EUR: /€[\d.,]+/g,
  // Matches £1,234.56 or £1234.56
  GBP: /£[\d,]+(?:\.\d{2})?/g,
  // Generic pattern for numbers with currency context
  GENERIC: /(?:USD|EUR|GBP|CAD|AUD)\s*[\d,]+(?:\.\d{2})?/gi,
};

/**
 * Email header patterns.
 */
const EMAIL_PATTERNS = {
  FROM: /^From:\s*(.+?)(?:\s*<(.+?)>)?$/im,
  TO: /^To:\s*(.+)$/im,
  CC: /^Cc:\s*(.+)$/im,
  SUBJECT: /^Subject:\s*(.+)$/im,
  // Matches email addresses
  EMAIL_ADDRESS: /[\w.+-]+@[\w.-]+\.\w+/g,
  // Matches "Name <email@example.com>" or just "email@example.com"
  EMAIL_WITH_NAME: /(?:"?([^"<]+)"?\s*)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/g,
};

/**
 * Parses an email address string into name and email.
 */
function parseEmailAddress(str: string): { name: string; email: string } | null {
  const emailMatch = str.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  if (!emailMatch) return null;

  const email = emailMatch[1];
  // Try to extract name from "Name <email>" format
  const nameMatch = str.match(/^"?([^"<]+)"?\s*</);
  const name = nameMatch ? nameMatch[1].trim() : email.split('@')[0];

  return { name, email };
}

/**
 * Extracts the subject line from raw email content.
 */
function extractSubject(rawEmail: string): string {
  const match = rawEmail.match(EMAIL_PATTERNS.SUBJECT);
  if (match) {
    return match[1].trim();
  }
  // Fallback: use first non-empty line
  const lines = rawEmail.split('\n').filter((line) => line.trim());
  return lines[0]?.substring(0, 100) || 'Untitled Deal';
}

/**
 * Extracts contacts from email headers.
 */
function extractContacts(rawEmail: string): DealContact[] {
  const contacts: DealContact[] = [];
  const seenEmails = new Set<string>();

  // Extract From (sender)
  const fromMatch = rawEmail.match(EMAIL_PATTERNS.FROM);
  if (fromMatch) {
    const fromStr = fromMatch[0].replace(/^From:\s*/i, '');
    const parsed = parseEmailAddress(fromStr);
    if (parsed && !seenEmails.has(parsed.email.toLowerCase())) {
      seenEmails.add(parsed.email.toLowerCase());
      contacts.push({
        name: parsed.name,
        email: parsed.email,
        role: 'sender',
      });
    }
  }

  // Extract To (recipients)
  const toMatch = rawEmail.match(EMAIL_PATTERNS.TO);
  if (toMatch) {
    const toStr = toMatch[1];
    const emails = toStr.split(/[,;]/);
    for (const emailStr of emails) {
      const parsed = parseEmailAddress(emailStr.trim());
      if (parsed && !seenEmails.has(parsed.email.toLowerCase())) {
        seenEmails.add(parsed.email.toLowerCase());
        contacts.push({
          name: parsed.name,
          email: parsed.email,
          role: 'recipient',
        });
      }
    }
  }

  // Extract Cc
  const ccMatch = rawEmail.match(EMAIL_PATTERNS.CC);
  if (ccMatch) {
    const ccStr = ccMatch[1];
    const emails = ccStr.split(/[,;]/);
    for (const emailStr of emails) {
      const parsed = parseEmailAddress(emailStr.trim());
      if (parsed && !seenEmails.has(parsed.email.toLowerCase())) {
        seenEmails.add(parsed.email.toLowerCase());
        contacts.push({
          name: parsed.name,
          email: parsed.email,
          role: 'cc',
        });
      }
    }
  }

  return contacts;
}

/**
 * Attempts to extract monetary amounts from text.
 * Returns the largest amount found (likely the deal value).
 */
function extractAmount(text: string): { amount: number; currency: CurrencyCode } | null {
  const amounts: { amount: number; currency: CurrencyCode }[] = [];

  // USD amounts
  const usdMatches = text.match(AMOUNT_PATTERNS.USD) || [];
  for (const match of usdMatches) {
    const numStr = match.replace(/[$,]/g, '');
    const num = parseFloat(numStr);
    if (!isNaN(num) && num > 0) {
      amounts.push({ amount: num, currency: 'USD' });
    }
  }

  // EUR amounts
  const eurMatches = text.match(AMOUNT_PATTERNS.EUR) || [];
  for (const match of eurMatches) {
    // European format: 1.234,56 -> 1234.56
    const numStr = match.replace(/€/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num) && num > 0) {
      amounts.push({ amount: num, currency: 'EUR' });
    }
  }

  // GBP amounts
  const gbpMatches = text.match(AMOUNT_PATTERNS.GBP) || [];
  for (const match of gbpMatches) {
    const numStr = match.replace(/[£,]/g, '');
    const num = parseFloat(numStr);
    if (!isNaN(num) && num > 0) {
      amounts.push({ amount: num, currency: 'GBP' });
    }
  }

  // Generic currency amounts (USD 1234, EUR 5000, etc.)
  const genericMatches = text.match(AMOUNT_PATTERNS.GENERIC) || [];
  for (const match of genericMatches) {
    const currencyMatch = match.match(/^(USD|EUR|GBP|CAD|AUD)/i);
    if (currencyMatch) {
      const currency = currencyMatch[1].toUpperCase() as CurrencyCode;
      const numStr = match.replace(/[A-Z,\s]/gi, '');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        amounts.push({ amount: num, currency });
      }
    }
  }

  if (amounts.length === 0) {
    return null;
  }

  // Return the largest amount (most likely to be the deal value)
  amounts.sort((a, b) => b.amount - a.amount);
  return amounts[0];
}

/**
 * Parses a raw email string into deal data.
 *
 * @param rawEmail - The raw email content (headers + body)
 * @param orgId - The organization ID this deal belongs to
 * @returns Partial deal data extracted from the email
 */
export function parseEmailToDeal(
  rawEmail: string,
  orgId: string
): Omit<Deal, 'id' | 'extractedAt' | 'updatedAt'> {
  const subject = extractSubject(rawEmail);
  const contacts = extractContacts(rawEmail);
  const amountInfo = extractAmount(rawEmail);

  return {
    subject,
    amount: amountInfo?.amount ?? null,
    currency: amountInfo?.currency ?? 'USD',
    contacts,
    organizationId: orgId,
    source: 'bcc',
    rawContent: rawEmail,
    status: 'new',
  };
}

/**
 * Parses screenshot OCR text into deal data.
 * Similar to email parsing but without header extraction.
 *
 * @param ocrText - OCR-extracted text from a screenshot
 * @param orgId - The organization ID this deal belongs to
 * @returns Partial deal data extracted from the screenshot
 */
export function parseScreenshotToDeal(
  ocrText: string,
  orgId: string
): Omit<Deal, 'id' | 'extractedAt' | 'updatedAt'> {
  // For screenshots, we extract what we can from the text
  const amountInfo = extractAmount(ocrText);

  // Try to find email addresses in the screenshot
  const emailMatches = ocrText.match(EMAIL_PATTERNS.EMAIL_ADDRESS) || [];
  const contacts: DealContact[] = emailMatches.slice(0, 10).map((email) => ({
    name: email.split('@')[0],
    email,
    role: 'recipient' as const,
  }));

  // Use first line as subject (or first 100 chars)
  const lines = ocrText.split('\n').filter((line) => line.trim());
  const subject = lines[0]?.substring(0, 100) || 'Screenshot Deal';

  return {
    subject,
    amount: amountInfo?.amount ?? null,
    currency: amountInfo?.currency ?? 'USD',
    contacts,
    organizationId: orgId,
    source: 'screenshot',
    rawContent: ocrText,
    status: 'new',
  };
}

export { extractAmount, extractContacts, extractSubject };
