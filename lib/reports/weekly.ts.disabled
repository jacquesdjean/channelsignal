import { prisma } from '@/lib/db';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { WeeklyReportContent } from './types';
import { Report } from '@prisma/client';

/**
 * Generates a weekly report for a user
 */
export async function generateWeeklyReport(
  userId: string,
  start: Date,
  end: Date
): Promise<Report> {
  // Gather all data for the report
  const content = await gatherWeeklyData(userId, start, end);

  // Generate HTML
  const htmlContent = renderWeeklyReportHtml(content);

  // Store the report
  const report = await prisma.report.create({
    data: {
      userId,
      type: 'WEEKLY',
      periodStart: start,
      periodEnd: end,
      content: content as unknown as object,
      htmlContent,
    },
  });

  return report;
}

/**
 * Gathers all data needed for the weekly report
 */
async function gatherWeeklyData(
  userId: string,
  start: Date,
  end: Date
): Promise<WeeklyReportContent> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const userEmail = user?.email || '';

  // Get emails in period
  const emails = await prisma.emailMessage.findMany({
    where: {
      userId,
      sentAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { sentAt: 'desc' },
  });

  // Calculate sent vs received
  let emailsSent = 0;
  let emailsReceived = 0;
  const orgsTouched = new Set<string>();
  const threadActivity = new Map<string, { subject: string; count: number; orgs: Set<string>; lastActivity: Date }>();

  for (const email of emails) {
    if (email.fromAddress === userEmail) {
      emailsSent++;
    } else {
      emailsReceived++;
    }

    // Track thread activity
    const threadKey = email.threadId || email.id;
    const existing = threadActivity.get(threadKey);
    if (existing) {
      existing.count++;
      if (email.sentAt > existing.lastActivity) {
        existing.lastActivity = email.sentAt;
      }
    } else {
      threadActivity.set(threadKey, {
        subject: email.subject,
        count: 1,
        orgs: new Set(),
        lastActivity: email.sentAt,
      });
    }
  }

  // Get new contacts in period
  const newContacts = await prisma.contact.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      org: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get new orgs in period
  const newOrgs = await prisma.org.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get all orgs for this user to count unique touched
  const allOrgs = await prisma.org.findMany({
    where: { userId },
    select: { domain: true },
  });

  // Count unique orgs touched based on email domains
  for (const email of emails) {
    const domain = email.fromAddress.split('@')[1];
    for (const org of allOrgs) {
      if (org.domain === domain) {
        orgsTouched.add(org.domain);
      }
    }
    for (const addr of email.toAddresses) {
      const toDomain = addr.split('@')[1];
      for (const org of allOrgs) {
        if (org.domain === toDomain) {
          orgsTouched.add(org.domain);
        }
      }
    }
  }

  // Get deals with activity in period
  const deals = await prisma.deal.findMany({
    where: {
      userId,
      updatedAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      org: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Build active threads list (top 5 by email count)
  const activeThreads = Array.from(threadActivity.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([, data]) => ({
      subject: data.subject,
      emailCount: data.count,
      participantOrgs: Array.from(data.orgs),
      lastActivity: format(data.lastActivity, 'MMM d, yyyy'),
    }));

  return {
    periodStart: format(start, 'MMM d, yyyy'),
    periodEnd: format(end, 'MMM d, yyyy'),
    activityOverview: {
      emailsSent,
      emailsReceived,
      uniqueOrgsContacted: orgsTouched.size,
    },
    newContacts: newContacts.map(c => ({
      name: c.name,
      email: c.email,
      orgName: c.org?.name || null,
      dateAdded: format(c.createdAt, 'MMM d, yyyy'),
    })),
    newOrganizations: newOrgs.map(o => ({
      name: o.name,
      domain: o.domain,
      type: o.type,
      firstContactDate: format(o.createdAt, 'MMM d, yyyy'),
    })),
    activeThreads,
    dealActivity: deals.map(d => ({
      title: d.title,
      orgName: d.org?.name || null,
      stage: d.stage,
      status: d.status,
      lastUpdated: format(d.updatedAt, 'MMM d, yyyy'),
    })),
  };
}

/**
 * Renders the weekly report as HTML
 */
function renderWeeklyReportHtml(content: WeeklyReportContent): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
    h2 { color: #444; margin-top: 30px; }
    .date-range { color: #666; font-size: 14px; margin-bottom: 20px; }
    .overview { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #f5f5f5; padding: 15px 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f9f9f9; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #666; }
    .empty { color: #999; font-style: italic; padding: 20px; text-align: center; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>Weekly Pipeline Summary</h1>
  <div class="date-range">${content.periodStart} - ${content.periodEnd}</div>

  <h2>Activity Overview</h2>
  <div class="overview">
    <div class="stat">
      <div class="stat-value">${content.activityOverview.emailsSent}</div>
      <div class="stat-label">Emails Sent</div>
    </div>
    <div class="stat">
      <div class="stat-value">${content.activityOverview.emailsReceived}</div>
      <div class="stat-label">Emails Received</div>
    </div>
    <div class="stat">
      <div class="stat-value">${content.activityOverview.uniqueOrgsContacted}</div>
      <div class="stat-label">Orgs Contacted</div>
    </div>
  </div>

  <h2>New Contacts</h2>
  ${content.newContacts.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Organization</th>
        <th>Date Added</th>
      </tr>
    </thead>
    <tbody>
      ${content.newContacts.map(c => `
      <tr>
        <td>${c.name || '-'}</td>
        <td>${c.email}</td>
        <td>${c.orgName || '-'}</td>
        <td>${c.dateAdded}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No new contacts this week</div>'}

  <h2>New Organizations</h2>
  ${content.newOrganizations.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Domain</th>
        <th>Type</th>
        <th>First Contact</th>
      </tr>
    </thead>
    <tbody>
      ${content.newOrganizations.map(o => `
      <tr>
        <td>${o.name}</td>
        <td>${o.domain || '-'}</td>
        <td>${o.type || '-'}</td>
        <td>${o.firstContactDate}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No new organizations this week</div>'}

  <h2>Active Threads</h2>
  ${content.activeThreads.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>Emails</th>
        <th>Last Activity</th>
      </tr>
    </thead>
    <tbody>
      ${content.activeThreads.map(t => `
      <tr>
        <td>${t.subject}</td>
        <td>${t.emailCount}</td>
        <td>${t.lastActivity}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No active threads this week</div>'}

  <h2>Deal Activity</h2>
  ${content.dealActivity.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Deal</th>
        <th>Organization</th>
        <th>Stage</th>
        <th>Status</th>
        <th>Last Updated</th>
      </tr>
    </thead>
    <tbody>
      ${content.dealActivity.map(d => `
      <tr>
        <td>${d.title}</td>
        <td>${d.orgName || '-'}</td>
        <td>${d.stage}</td>
        <td>${d.status}</td>
        <td>${d.lastUpdated}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No deal activity this week</div>'}

  <div class="footer">
    Generated by ChannelSignal
  </div>
</body>
</html>
  `.trim();
}

/**
 * Gets the default weekly report period (last full week)
 */
export function getDefaultWeeklyPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); // Monday
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); // Sunday
  return { start: lastWeekStart, end: lastWeekEnd };
}
