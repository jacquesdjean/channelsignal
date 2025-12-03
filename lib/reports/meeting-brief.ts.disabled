import { prisma } from '@/lib/db';
import { format, subDays } from 'date-fns';
import { MeetingBriefContent } from './types';
import { Report } from '@prisma/client';

/**
 * Generates a meeting brief report
 */
export async function generateMeetingBrief(
  userId: string,
  meetingId: string
): Promise<Report> {
  const content = await gatherMeetingBriefData(userId, meetingId);

  if (!content) {
    throw new Error('Meeting not found');
  }

  const htmlContent = renderMeetingBriefHtml(content);

  const report = await prisma.report.create({
    data: {
      userId,
      type: 'MEETING_BRIEF',
      meetingId,
      content: content as unknown as object,
      htmlContent,
    },
  });

  return report;
}

/**
 * Gathers all data needed for the meeting brief
 */
async function gatherMeetingBriefData(
  userId: string,
  meetingId: string
): Promise<MeetingBriefContent | null> {
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      userId,
    },
    include: {
      org: true,
      emails: {
        orderBy: { sentAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!meeting) {
    return null;
  }

  // Get participants from meeting emails
  const participantEmails = new Set<string>();
  for (const email of meeting.emails) {
    participantEmails.add(email.fromAddress);
    email.toAddresses.forEach(addr => participantEmails.add(addr));
    email.ccAddresses.forEach(addr => participantEmails.add(addr));
  }

  // Filter out our BCC address
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bccAddress: true, email: true },
  });

  participantEmails.delete(user?.bccAddress || '');

  // Get contact details for participants
  const contacts = await prisma.contact.findMany({
    where: {
      userId,
      email: { in: Array.from(participantEmails) },
    },
    include: {
      org: true,
    },
  });

  const contactMap = new Map(contacts.map(c => [c.email, c]));

  const participants = Array.from(participantEmails)
    .filter(email => email !== user?.email) // Exclude the user
    .map(email => {
      const contact = contactMap.get(email);
      return {
        name: contact?.name || null,
        email,
        title: contact?.title || null,
        orgName: contact?.org?.name || null,
      };
    });

  // Get organization context if meeting has an org
  let organizationContext: MeetingBriefContent['organizationContext'] = null;

  if (meeting.org) {
    const orgEmails = await prisma.emailMessage.count({
      where: {
        userId,
        OR: [
          { fromAddress: { endsWith: `@${meeting.org.domain}` } },
          { toAddresses: { has: meeting.org.domain ? `@${meeting.org.domain}` : '' } },
        ],
      },
    });

    const orgDeals = await prisma.deal.findMany({
      where: {
        userId,
        orgId: meeting.org.id,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const firstOrgContact = await prisma.contact.findFirst({
      where: {
        userId,
        orgId: meeting.org.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    organizationContext = {
      name: meeting.org.name,
      type: meeting.org.type,
      firstContact: firstOrgContact ? format(firstOrgContact.createdAt, 'MMM d, yyyy') : null,
      totalEmails: orgEmails,
      recentDeals: orgDeals.map(d => ({
        title: d.title,
        stage: d.stage,
        status: d.status,
      })),
    };
  }

  // Recent thread summary
  const recentThreadSummary = meeting.emails.slice(0, 5).map(email => ({
    subject: email.subject,
    date: format(email.sentAt, 'MMM d, yyyy'),
    snippet: email.textBody?.substring(0, 200) || '(No preview available)',
  }));

  // Related artifacts (last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30);
  const artifacts = await prisma.artifact.findMany({
    where: {
      userId,
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const relatedArtifacts = artifacts.map(a => ({
    filename: a.filename,
    notes: a.notes,
    uploadedAt: format(a.createdAt, 'MMM d, yyyy'),
  }));

  // Open items (open deals and upcoming meetings)
  const openItems: MeetingBriefContent['openItems'] = [];

  // Get open deals related to this org
  if (meeting.orgId) {
    const openDeals = await prisma.deal.findMany({
      where: {
        userId,
        orgId: meeting.orgId,
        status: 'OPEN',
      },
    });

    for (const deal of openDeals) {
      openItems.push({
        type: 'deal',
        title: deal.title,
        details: `Stage: ${deal.stage}${deal.amount ? `, Amount: $${deal.amount.toLocaleString()}` : ''}`,
      });
    }
  }

  return {
    meetingTitle: meeting.title,
    scheduledAt: meeting.scheduledAt ? format(meeting.scheduledAt, 'MMM d, yyyy h:mm a') : null,
    participants,
    organizationContext,
    recentThreadSummary,
    relatedArtifacts,
    openItems,
  };
}

/**
 * Renders the meeting brief as HTML
 */
function renderMeetingBriefHtml(content: MeetingBriefContent): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
    h2 { color: #444; margin-top: 30px; font-size: 18px; }
    .scheduled { color: #666; font-size: 14px; margin-top: -10px; margin-bottom: 20px; }
    .section { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .participant { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .participant:last-child { border-bottom: none; }
    .participant-name { font-weight: 500; }
    .participant-org { color: #666; font-size: 14px; }
    .context-stat { display: inline-block; margin-right: 20px; }
    .context-stat-value { font-weight: bold; }
    .thread { padding: 10px 0; border-bottom: 1px solid #eee; }
    .thread:last-child { border-bottom: none; }
    .thread-subject { font-weight: 500; }
    .thread-date { color: #666; font-size: 12px; }
    .thread-snippet { color: #666; font-size: 14px; margin-top: 5px; }
    .artifact { padding: 8px 0; border-bottom: 1px solid #eee; }
    .artifact:last-child { border-bottom: none; }
    .open-item { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .open-item-type { font-size: 10px; text-transform: uppercase; color: #856404; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f9f9f9; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #666; }
    .empty { color: #999; font-style: italic; padding: 15px; text-align: center; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>Meeting Brief: ${content.meetingTitle}</h1>
  ${content.scheduledAt ? `<div class="scheduled">Scheduled: ${content.scheduledAt}</div>` : ''}

  <h2>Participants</h2>
  <div class="section">
    ${content.participants.length > 0 ? content.participants.map(p => `
    <div class="participant">
      <div>
        <div class="participant-name">${p.name || p.email}</div>
        ${p.title ? `<div style="font-size: 12px; color: #888;">${p.title}</div>` : ''}
      </div>
      <div class="participant-org">${p.orgName || '-'}</div>
    </div>
    `).join('') : '<div class="empty">No participants identified</div>'}
  </div>

  ${content.organizationContext ? `
  <h2>Organization Context</h2>
  <div class="section">
    <h3 style="margin-top: 0;">${content.organizationContext.name}</h3>
    <div style="margin-bottom: 15px;">
      ${content.organizationContext.type ? `<span class="context-stat"><span class="context-stat-value">Type:</span> ${content.organizationContext.type}</span>` : ''}
      ${content.organizationContext.firstContact ? `<span class="context-stat"><span class="context-stat-value">First Contact:</span> ${content.organizationContext.firstContact}</span>` : ''}
      <span class="context-stat"><span class="context-stat-value">Total Emails:</span> ${content.organizationContext.totalEmails}</span>
    </div>
    ${content.organizationContext.recentDeals.length > 0 ? `
    <h4 style="margin-bottom: 10px;">Recent Deals</h4>
    <table>
      <thead>
        <tr>
          <th>Deal</th>
          <th>Stage</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${content.organizationContext.recentDeals.map(d => `
        <tr>
          <td>${d.title}</td>
          <td>${d.stage}</td>
          <td>${d.status}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<div class="empty">No deals with this organization</div>'}
  </div>
  ` : ''}

  <h2>Recent Thread Summary</h2>
  <div class="section">
    ${content.recentThreadSummary.length > 0 ? content.recentThreadSummary.map(t => `
    <div class="thread">
      <div class="thread-subject">${t.subject}</div>
      <div class="thread-date">${t.date}</div>
      <div class="thread-snippet">${t.snippet}...</div>
    </div>
    `).join('') : '<div class="empty">No recent email threads</div>'}
  </div>

  <h2>Related Artifacts</h2>
  <div class="section">
    ${content.relatedArtifacts.length > 0 ? content.relatedArtifacts.map(a => `
    <div class="artifact">
      <div><strong>${a.filename}</strong></div>
      ${a.notes ? `<div style="font-size: 14px; color: #666;">${a.notes}</div>` : ''}
      <div style="font-size: 12px; color: #888;">Uploaded: ${a.uploadedAt}</div>
    </div>
    `).join('') : '<div class="empty">No recent artifacts</div>'}
  </div>

  <h2>Open Items</h2>
  <div class="section">
    ${content.openItems.length > 0 ? content.openItems.map(item => `
    <div class="open-item">
      <div class="open-item-type">${item.type}</div>
      <div><strong>${item.title}</strong></div>
      <div style="font-size: 14px; color: #666;">${item.details}</div>
    </div>
    `).join('') : '<div class="empty">No open items</div>'}
  </div>

  <div class="footer">
    Generated by ChannelSignal
  </div>
</body>
</html>
  `.trim();
}
