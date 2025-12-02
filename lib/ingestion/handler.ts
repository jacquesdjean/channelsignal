import { prisma } from '@/lib/db';
import {
  InboundEmailPayload,
  ExtractedContact,
} from './types';
import {
  parseInboundEmail,
  extractContacts,
  isPersonalDomain,
  classifyMeeting,
  parseEmailAddress,
} from './parser';

/**
 * Pure handler function for processing inbound emails
 * Orchestrates the entire ingestion flow
 */
export async function handleInboundEmail(payload: InboundEmailPayload): Promise<void> {
  // 1. Parse the email payload
  const parsedEmail = parseInboundEmail(payload);

  // 2. Find user by BCC address
  // The BCC address might be in the 'to' field depending on how the provider routes it
  let bccAddress = parsedEmail.bccRecipient;

  if (!bccAddress) {
    // Try to find our address in the to field
    for (const addr of parsedEmail.toAddresses) {
      if (addr.startsWith('u_') && addr.includes('@in.')) {
        bccAddress = addr;
        break;
      }
    }
  }

  if (!bccAddress) {
    console.error('No valid BCC address found in email');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { bccAddress },
  });

  if (!user) {
    console.error(`No user found for BCC address: ${bccAddress}`);
    return;
  }

  // 3. Extract contacts
  const extractedContacts = extractContacts(payload);

  // 4. Create or find orgs and contacts
  const contactToOrg: Map<string, string | null> = new Map();

  for (const contact of extractedContacts) {
    // Skip if it's a personal email domain
    if (isPersonalDomain(contact.domain)) {
      // Still create contact, but without org
      await upsertContact(user.id, contact, null);
      contactToOrg.set(contact.email, null);
      continue;
    }

    // Create or find org by domain
    const org = await upsertOrg(user.id, contact.domain!);

    // Create or find contact
    await upsertContact(user.id, contact, org.id);
    contactToOrg.set(contact.email, org.id);
  }

  // 5. Classify email (meeting or regular)
  const meetingType = classifyMeeting(parsedEmail.subject);

  let meetingId: string | null = null;
  let dealId: string | null = null;

  if (meetingType) {
    // Create or find meeting
    const primaryContact = extractedContacts[0];
    const orgId = primaryContact ? contactToOrg.get(primaryContact.email) : null;

    const meeting = await upsertMeeting(
      user.id,
      parsedEmail.subject,
      meetingType,
      orgId || null
    );
    meetingId = meeting.id;
  }

  // 6. Store email message
  try {
    await prisma.emailMessage.create({
      data: {
        userId: user.id,
        messageId: parsedEmail.messageId,
        threadId: parsedEmail.threadId,
        fromAddress: parsedEmail.fromAddress,
        toAddresses: parsedEmail.toAddresses,
        ccAddresses: parsedEmail.ccAddresses,
        subject: parsedEmail.subject,
        textBody: parsedEmail.textBody,
        htmlBody: parsedEmail.htmlBody,
        sentAt: parsedEmail.sentAt,
        meetingId,
        dealId,
      },
    });
  } catch (error: unknown) {
    // Handle duplicate message ID
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log(`Email ${parsedEmail.messageId} already processed`);
      return;
    }
    throw error;
  }

  console.log(`Processed email for user ${user.id}: ${parsedEmail.subject}`);
}

/**
 * Creates or updates an organization
 */
async function upsertOrg(userId: string, domain: string) {
  // Try to find existing org
  let org = await prisma.org.findUnique({
    where: {
      userId_domain: {
        userId,
        domain,
      },
    },
  });

  if (!org) {
    // Create new org with domain as name (can be updated later)
    const name = formatOrgName(domain);
    org = await prisma.org.create({
      data: {
        userId,
        domain,
        name,
      },
    });
  }

  return org;
}

/**
 * Creates or updates a contact
 */
async function upsertContact(
  userId: string,
  contact: ExtractedContact,
  orgId: string | null
) {
  // Try to find existing contact
  let existingContact = await prisma.contact.findUnique({
    where: {
      userId_email: {
        userId,
        email: contact.email,
      },
    },
  });

  if (existingContact) {
    // Update name if we have a better one
    if (contact.name && !existingContact.name) {
      await prisma.contact.update({
        where: { id: existingContact.id },
        data: { name: contact.name },
      });
    }
    return existingContact;
  }

  // Create new contact
  return prisma.contact.create({
    data: {
      userId,
      email: contact.email,
      name: contact.name,
      orgId,
    },
  });
}

/**
 * Creates or finds a meeting based on title
 */
async function upsertMeeting(
  userId: string,
  title: string,
  meetingType: 'QBR' | 'ANNUAL_REVIEW' | 'WEEKLY_CHECKIN' | 'DEAL_REVIEW' | 'OTHER',
  orgId: string | null
) {
  // Look for existing meeting with similar title for this user
  const existingMeeting = await prisma.meeting.findFirst({
    where: {
      userId,
      title: {
        equals: title,
        mode: 'insensitive',
      },
    },
  });

  if (existingMeeting) {
    return existingMeeting;
  }

  return prisma.meeting.create({
    data: {
      userId,
      title,
      meetingType,
      orgId,
    },
  });
}

/**
 * Formats a domain into a readable org name
 * e.g., "acme-corp.com" -> "Acme Corp"
 */
function formatOrgName(domain: string): string {
  const name = domain
    .replace(/\.(com|io|co|org|net|app|dev)$/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return name;
}
