import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// Create mock before vi.mock call
const prismaMock = mockDeep<PrismaClient>();

// Mock the db module
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

// Import after mock setup
const { generateWeeklyReport, getDefaultWeeklyPeriod } = await import('../weekly');

describe('generateWeeklyReport', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'user-1',
    email: 'rep@company.com',
    emailVerified: null,
    name: 'Test Rep',
    image: null,
    bccAddress: 'u_abc123@in.channelsignal.com',
    createdAt: new Date(),
  };

  const start = new Date('2024-01-08T00:00:00Z');
  const end = new Date('2024-01-14T23:59:59Z');

  it('generates a weekly report with all sections', async () => {
    // Mock user lookup
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    // Mock emails
    prismaMock.emailMessage.findMany.mockResolvedValue([
      {
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-1',
        threadId: 'thread-1',
        fromAddress: 'rep@company.com',
        toAddresses: ['client@acme.com'],
        ccAddresses: [],
        subject: 'Project Update',
        textBody: 'Here is the update...',
        htmlBody: null,
        sentAt: new Date('2024-01-10T10:00:00Z'),
        receivedAt: new Date('2024-01-10T10:00:00Z'),
        dealId: null,
        meetingId: null,
      },
      {
        id: 'email-2',
        userId: 'user-1',
        messageId: 'msg-2',
        threadId: 'thread-1',
        fromAddress: 'client@acme.com',
        toAddresses: ['rep@company.com'],
        ccAddresses: [],
        subject: 'Re: Project Update',
        textBody: 'Thanks for the update...',
        htmlBody: null,
        sentAt: new Date('2024-01-10T14:00:00Z'),
        receivedAt: new Date('2024-01-10T14:00:00Z'),
        dealId: null,
        meetingId: null,
      },
    ]);

    // Mock new contacts
    prismaMock.contact.findMany.mockResolvedValue([
      {
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@acme.com',
        name: 'John Smith',
        title: 'VP Sales',
        createdAt: new Date('2024-01-09T10:00:00Z'),
        org: {
          id: 'org-1',
          userId: 'user-1',
          name: 'Acme Corp',
          domain: 'acme.com',
          type: 'END_CUSTOMER',
          createdAt: new Date(),
        },
      },
    ] as never);

    // Mock new orgs
    prismaMock.org.findMany.mockResolvedValue([
      {
        id: 'org-1',
        userId: 'user-1',
        name: 'Acme Corp',
        domain: 'acme.com',
        type: 'END_CUSTOMER',
        createdAt: new Date('2024-01-09T09:00:00Z'),
      },
    ]);

    // Mock deals
    prismaMock.deal.findMany.mockResolvedValue([
      {
        id: 'deal-1',
        userId: 'user-1',
        orgId: 'org-1',
        title: 'Acme Enterprise Contract',
        amount: 50000,
        currency: 'USD',
        stage: 'PROPOSAL',
        status: 'OPEN',
        expectedClose: null,
        createdAt: new Date(),
        updatedAt: new Date('2024-01-12T10:00:00Z'),
        org: {
          id: 'org-1',
          userId: 'user-1',
          name: 'Acme Corp',
          domain: 'acme.com',
          type: 'END_CUSTOMER',
          createdAt: new Date(),
        },
      },
    ] as never);

    // Mock report creation
    prismaMock.report.create.mockResolvedValue({
      id: 'report-1',
      userId: 'user-1',
      type: 'WEEKLY',
      periodStart: start,
      periodEnd: end,
      meetingId: null,
      content: {},
      htmlContent: '<html>...</html>',
      generatedAt: new Date(),
    });

    const report = await generateWeeklyReport('user-1', start, end);

    expect(report.id).toBe('report-1');
    expect(report.type).toBe('WEEKLY');
    expect(prismaMock.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
      }),
    });
  });

  it('calculates email sent vs received correctly', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    // 3 sent, 2 received
    prismaMock.emailMessage.findMany.mockResolvedValue([
      { id: '1', userId: 'user-1', messageId: 'm1', fromAddress: 'rep@company.com', toAddresses: ['a@test.com'], ccAddresses: [], threadId: null, subject: 'S1', textBody: null, htmlBody: null, sentAt: new Date('2024-01-10'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '2', userId: 'user-1', messageId: 'm2', fromAddress: 'rep@company.com', toAddresses: ['b@test.com'], ccAddresses: [], threadId: null, subject: 'S2', textBody: null, htmlBody: null, sentAt: new Date('2024-01-11'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '3', userId: 'user-1', messageId: 'm3', fromAddress: 'rep@company.com', toAddresses: ['c@test.com'], ccAddresses: [], threadId: null, subject: 'S3', textBody: null, htmlBody: null, sentAt: new Date('2024-01-12'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '4', userId: 'user-1', messageId: 'm4', fromAddress: 'a@test.com', toAddresses: ['rep@company.com'], ccAddresses: [], threadId: null, subject: 'R1', textBody: null, htmlBody: null, sentAt: new Date('2024-01-10'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '5', userId: 'user-1', messageId: 'm5', fromAddress: 'b@test.com', toAddresses: ['rep@company.com'], ccAddresses: [], threadId: null, subject: 'R2', textBody: null, htmlBody: null, sentAt: new Date('2024-01-11'), receivedAt: new Date(), dealId: null, meetingId: null },
    ]);

    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.org.findMany.mockResolvedValue([]);
    prismaMock.deal.findMany.mockResolvedValue([]);

    let capturedContent: Record<string, unknown> = {};
    prismaMock.report.create.mockImplementation(async (args) => {
      capturedContent = args.data.content as Record<string, unknown>;
      return {
        id: 'report-1',
        userId: 'user-1',
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
        meetingId: null,
        content: args.data.content as object,
        htmlContent: args.data.htmlContent || null,
        generatedAt: new Date(),
      };
    });

    await generateWeeklyReport('user-1', start, end);

    expect((capturedContent.activityOverview as Record<string, number>).emailsSent).toBe(3);
    expect((capturedContent.activityOverview as Record<string, number>).emailsReceived).toBe(2);
  });

  it('groups active threads by thread ID', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    // 3 emails in same thread, 1 in different thread
    prismaMock.emailMessage.findMany.mockResolvedValue([
      { id: '1', userId: 'user-1', messageId: 'm1', fromAddress: 'a@test.com', toAddresses: ['rep@company.com'], ccAddresses: [], threadId: 'thread-A', subject: 'Thread A Subject', textBody: null, htmlBody: null, sentAt: new Date('2024-01-10T10:00:00Z'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '2', userId: 'user-1', messageId: 'm2', fromAddress: 'rep@company.com', toAddresses: ['a@test.com'], ccAddresses: [], threadId: 'thread-A', subject: 'Re: Thread A Subject', textBody: null, htmlBody: null, sentAt: new Date('2024-01-10T12:00:00Z'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '3', userId: 'user-1', messageId: 'm3', fromAddress: 'a@test.com', toAddresses: ['rep@company.com'], ccAddresses: [], threadId: 'thread-A', subject: 'Re: Thread A Subject', textBody: null, htmlBody: null, sentAt: new Date('2024-01-10T14:00:00Z'), receivedAt: new Date(), dealId: null, meetingId: null },
      { id: '4', userId: 'user-1', messageId: 'm4', fromAddress: 'b@test.com', toAddresses: ['rep@company.com'], ccAddresses: [], threadId: 'thread-B', subject: 'Different Thread', textBody: null, htmlBody: null, sentAt: new Date('2024-01-11T10:00:00Z'), receivedAt: new Date(), dealId: null, meetingId: null },
    ]);

    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.org.findMany.mockResolvedValue([]);
    prismaMock.deal.findMany.mockResolvedValue([]);

    let capturedContent: Record<string, unknown> = {};
    prismaMock.report.create.mockImplementation(async (args) => {
      capturedContent = args.data.content as Record<string, unknown>;
      return {
        id: 'report-1',
        userId: 'user-1',
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
        meetingId: null,
        content: args.data.content as object,
        htmlContent: args.data.htmlContent || null,
        generatedAt: new Date(),
      };
    });

    await generateWeeklyReport('user-1', start, end);

    const activeThreads = capturedContent.activeThreads as Array<{ subject: string; emailCount: number }>;
    // Should have 2 threads, sorted by count (3 then 1)
    expect(activeThreads.length).toBe(2);
    expect(activeThreads[0].emailCount).toBe(3);
    expect(activeThreads[1].emailCount).toBe(1);
  });

  it('handles empty data gracefully', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.emailMessage.findMany.mockResolvedValue([]);
    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.org.findMany.mockResolvedValue([]);
    prismaMock.deal.findMany.mockResolvedValue([]);

    prismaMock.report.create.mockResolvedValue({
      id: 'report-1',
      userId: 'user-1',
      type: 'WEEKLY',
      periodStart: start,
      periodEnd: end,
      meetingId: null,
      content: {},
      htmlContent: '<html>...</html>',
      generatedAt: new Date(),
    });

    const report = await generateWeeklyReport('user-1', start, end);

    expect(report).toBeDefined();
    expect(prismaMock.report.create).toHaveBeenCalled();
  });

  it('generates valid HTML content', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.emailMessage.findMany.mockResolvedValue([]);
    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.org.findMany.mockResolvedValue([]);
    prismaMock.deal.findMany.mockResolvedValue([]);

    let capturedHtml = '';
    prismaMock.report.create.mockImplementation(async (args) => {
      capturedHtml = args.data.htmlContent as string;
      return {
        id: 'report-1',
        userId: 'user-1',
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
        meetingId: null,
        content: args.data.content as object,
        htmlContent: capturedHtml,
        generatedAt: new Date(),
      };
    });

    await generateWeeklyReport('user-1', start, end);

    // Verify HTML structure
    expect(capturedHtml).toContain('<!DOCTYPE html>');
    expect(capturedHtml).toContain('<html>');
    expect(capturedHtml).toContain('Weekly Pipeline Summary');
    expect(capturedHtml).toContain('Activity Overview');
    expect(capturedHtml).toContain('New Contacts');
    expect(capturedHtml).toContain('New Organizations');
    expect(capturedHtml).toContain('Active Threads');
    expect(capturedHtml).toContain('Deal Activity');
  });

  it('includes correct period dates in content', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.emailMessage.findMany.mockResolvedValue([]);
    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.org.findMany.mockResolvedValue([]);
    prismaMock.deal.findMany.mockResolvedValue([]);

    let capturedContent: Record<string, unknown> = {};
    prismaMock.report.create.mockImplementation(async (args) => {
      capturedContent = args.data.content as Record<string, unknown>;
      return {
        id: 'report-1',
        userId: 'user-1',
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
        meetingId: null,
        content: args.data.content as object,
        htmlContent: args.data.htmlContent || null,
        generatedAt: new Date(),
      };
    });

    await generateWeeklyReport('user-1', start, end);

    expect(capturedContent.periodStart).toBe('Jan 8, 2024');
    expect(capturedContent.periodEnd).toBe('Jan 14, 2024');
  });

  it('limits active threads to top 5', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    // Create 7 threads with different email counts
    const emails = [];
    for (let i = 1; i <= 7; i++) {
      for (let j = 0; j < i; j++) {
        emails.push({
          id: `email-${i}-${j}`,
          userId: 'user-1',
          messageId: `msg-${i}-${j}`,
          fromAddress: 'test@test.com',
          toAddresses: ['rep@company.com'],
          ccAddresses: [],
          threadId: `thread-${i}`,
          subject: `Thread ${i}`,
          textBody: null,
          htmlBody: null,
          sentAt: new Date('2024-01-10'),
          receivedAt: new Date(),
          dealId: null,
          meetingId: null,
        });
      }
    }
    prismaMock.emailMessage.findMany.mockResolvedValue(emails);

    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.org.findMany.mockResolvedValue([]);
    prismaMock.deal.findMany.mockResolvedValue([]);

    let capturedContent: Record<string, unknown> = {};
    prismaMock.report.create.mockImplementation(async (args) => {
      capturedContent = args.data.content as Record<string, unknown>;
      return {
        id: 'report-1',
        userId: 'user-1',
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
        meetingId: null,
        content: args.data.content as object,
        htmlContent: args.data.htmlContent || null,
        generatedAt: new Date(),
      };
    });

    await generateWeeklyReport('user-1', start, end);

    const activeThreads = capturedContent.activeThreads as Array<{ emailCount: number }>;
    expect(activeThreads.length).toBe(5);
    // Should be sorted by count descending (7, 6, 5, 4, 3)
    expect(activeThreads[0].emailCount).toBe(7);
    expect(activeThreads[4].emailCount).toBe(3);
  });
});

describe('getDefaultWeeklyPeriod', () => {
  it('returns last full week (Monday to Sunday)', () => {
    // Mock current date to be a Wednesday
    const mockDate = new Date('2024-01-17T12:00:00Z'); // Wednesday
    vi.setSystemTime(mockDate);

    const { start, end } = getDefaultWeeklyPeriod();

    // Last full week should be Jan 8 (Monday) to Jan 14 (Sunday)
    expect(start.getUTCDay()).toBe(1); // Monday
    expect(end.getUTCDay()).toBe(0); // Sunday

    // Verify dates are in the past week
    expect(start < mockDate).toBe(true);
    expect(end < mockDate).toBe(true);

    vi.useRealTimers();
  });

  it('returns consistent week boundaries', () => {
    // Test on different days of the week
    const testCases = [
      { current: '2024-01-15T12:00:00Z', expectedStart: '2024-01-08' }, // Monday
      { current: '2024-01-18T12:00:00Z', expectedStart: '2024-01-08' }, // Thursday
      { current: '2024-01-21T12:00:00Z', expectedStart: '2024-01-08' }, // Sunday
    ];

    for (const { current, expectedStart } of testCases) {
      vi.setSystemTime(new Date(current));
      const { start } = getDefaultWeeklyPeriod();
      expect(start.toISOString().split('T')[0]).toBe(expectedStart);
    }

    vi.useRealTimers();
  });
});
