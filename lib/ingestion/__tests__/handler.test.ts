import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import type { InboundEmailPayload } from '../types';

// Create mock before vi.mock call
const prismaMock = mockDeep<PrismaClient>();

// Mock the db module - factory must not reference external variables
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

// Import after mock setup
const { handleInboundEmail } = await import('../handler');

describe('handleInboundEmail', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  const basePayload: InboundEmailPayload = {
    messageId: 'msg-123',
    from: 'John Doe <john@example.com>',
    to: ['u_abc123@in.channelsignal.com', 'jane@company.com'],
    subject: 'Test Email Subject',
    textBody: 'Hello world',
    htmlBody: '<p>Hello world</p>',
    sentAt: '2024-01-15T10:00:00Z',
  };

  const mockUser = {
    id: 'user-1',
    email: 'rep@company.com',
    emailVerified: null,
    name: 'Test Rep',
    image: null,
    bccAddress: 'u_abc123@in.channelsignal.com',
    createdAt: new Date(),
  };

  describe('user lookup', () => {
    it('finds user by BCC address from to field', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.org.findUnique.mockResolvedValue(null);
      prismaMock.org.create.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: ['u_abc123@in.channelsignal.com', 'jane@company.com'],
        ccAddresses: [],
        subject: 'Test Email Subject',
        textBody: 'Hello world',
        htmlBody: '<p>Hello world</p>',
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { bccAddress: 'u_abc123@in.channelsignal.com' },
      });
    });

    it('finds user by BCC address from bcc field', async () => {
      const payloadWithBcc: InboundEmailPayload = {
        ...basePayload,
        to: ['jane@company.com'],
        bcc: ['u_xyz789@in.channelsignal.com'],
      };

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        bccAddress: 'u_xyz789@in.channelsignal.com',
      });
      prismaMock.org.findUnique.mockResolvedValue(null);
      prismaMock.org.create.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: ['jane@company.com'],
        ccAddresses: [],
        subject: 'Test Email Subject',
        textBody: 'Hello world',
        htmlBody: '<p>Hello world</p>',
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(payloadWithBcc);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { bccAddress: 'u_xyz789@in.channelsignal.com' },
      });
    });

    it('returns early when no BCC address found', async () => {
      const payloadNoBcc: InboundEmailPayload = {
        ...basePayload,
        to: ['jane@company.com', 'bob@other.com'],
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handleInboundEmail(payloadNoBcc);

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No valid BCC address found in email');

      consoleSpy.mockRestore();
    });

    it('returns early when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handleInboundEmail(basePayload);

      expect(prismaMock.emailMessage.create).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No user found for BCC address')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('contact and org creation', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
    });

    it('creates org for corporate email domain', async () => {
      prismaMock.org.findUnique.mockResolvedValue(null);
      prismaMock.org.create.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Test',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.org.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          domain: 'example.com',
          name: 'Example',
        }),
      });
    });

    it('reuses existing org for known domain', async () => {
      const existingOrg = {
        id: 'existing-org',
        userId: 'user-1',
        name: 'Example Corp',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      };

      prismaMock.org.findUnique.mockResolvedValue(existingOrg);
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'existing-org',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Test',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.org.create).not.toHaveBeenCalled();
    });

    it('skips org creation for personal email domains', async () => {
      // Payload with only personal email domains
      const personalPayload: InboundEmailPayload = {
        messageId: 'msg-personal',
        from: 'personal.user@gmail.com',
        to: ['u_abc123@in.channelsignal.com'],  // Only the BCC address
        subject: 'Test from personal email',
      };

      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: null,
        email: 'personal.user@gmail.com',
        name: null,
        title: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-personal',
        threadId: null,
        fromAddress: 'personal.user@gmail.com',
        toAddresses: ['u_abc123@in.channelsignal.com'],
        ccAddresses: [],
        subject: 'Test from personal email',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(personalPayload);

      // Should not create org for gmail.com (personal domain)
      expect(prismaMock.org.create).not.toHaveBeenCalled();
      // Contact should be created without org association
      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'personal.user@gmail.com',
          orgId: null,
        }),
      });
    });

    it('creates contact with org association', async () => {
      prismaMock.org.findUnique.mockResolvedValue(null);
      prismaMock.org.create.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Test',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          email: 'john@example.com',
          name: 'John Doe',
          orgId: 'org-1',
        }),
      });
    });

    it('updates contact name if not previously set', async () => {
      const existingContact = {
        id: 'existing-contact',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: null,
        title: null,
        createdAt: new Date(),
      };

      prismaMock.org.findUnique.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue(existingContact);
      prismaMock.contact.update.mockResolvedValue({
        ...existingContact,
        name: 'John Doe',
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Test',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.contact.update).toHaveBeenCalledWith({
        where: { id: 'existing-contact' },
        data: { name: 'John Doe' },
      });
    });
  });

  describe('meeting classification', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.org.findUnique.mockResolvedValue(null);
      prismaMock.org.create.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
    });

    it('creates meeting for QBR subject', async () => {
      const qbrPayload: InboundEmailPayload = {
        ...basePayload,
        subject: 'Q4 QBR with Acme Corp',
      };

      prismaMock.meeting.findFirst.mockResolvedValue(null);
      prismaMock.meeting.create.mockResolvedValue({
        id: 'meeting-1',
        userId: 'user-1',
        orgId: 'org-1',
        title: 'Q4 QBR with Acme Corp',
        meetingType: 'QBR',
        scheduledAt: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Q4 QBR with Acme Corp',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: 'meeting-1',
      });

      await handleInboundEmail(qbrPayload);

      expect(prismaMock.meeting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Q4 QBR with Acme Corp',
          meetingType: 'QBR',
        }),
      });
    });

    it('creates meeting for weekly sync subject', async () => {
      const weeklyPayload: InboundEmailPayload = {
        ...basePayload,
        subject: 'Weekly sync - Team Update',
      };

      prismaMock.meeting.findFirst.mockResolvedValue(null);
      prismaMock.meeting.create.mockResolvedValue({
        id: 'meeting-1',
        userId: 'user-1',
        orgId: 'org-1',
        title: 'Weekly sync - Team Update',
        meetingType: 'WEEKLY_CHECKIN',
        scheduledAt: null,
        createdAt: new Date(),
      });
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Weekly sync - Team Update',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: 'meeting-1',
      });

      await handleInboundEmail(weeklyPayload);

      expect(prismaMock.meeting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meetingType: 'WEEKLY_CHECKIN',
        }),
      });
    });

    it('does not create meeting for non-meeting subject', async () => {
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Test Email Subject',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.meeting.create).not.toHaveBeenCalled();
    });

    it('reuses existing meeting with same title', async () => {
      const qbrPayload: InboundEmailPayload = {
        ...basePayload,
        subject: 'Q4 QBR with Acme Corp',
      };

      const existingMeeting = {
        id: 'existing-meeting',
        userId: 'user-1',
        orgId: 'org-1',
        title: 'Q4 QBR with Acme Corp',
        meetingType: 'QBR' as const,
        scheduledAt: null,
        createdAt: new Date(),
      };

      prismaMock.meeting.findFirst.mockResolvedValue(existingMeeting);
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: [],
        ccAddresses: [],
        subject: 'Q4 QBR with Acme Corp',
        textBody: null,
        htmlBody: null,
        sentAt: new Date(),
        receivedAt: new Date(),
        dealId: null,
        meetingId: 'existing-meeting',
      });

      await handleInboundEmail(qbrPayload);

      expect(prismaMock.meeting.create).not.toHaveBeenCalled();
      expect(prismaMock.emailMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meetingId: 'existing-meeting',
        }),
      });
    });
  });

  describe('email message storage', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.org.findUnique.mockResolvedValue({
        id: 'org-1',
        userId: 'user-1',
        name: 'Example',
        domain: 'example.com',
        type: null,
        createdAt: new Date(),
      });
      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        orgId: 'org-1',
        email: 'john@example.com',
        name: 'John Doe',
        title: null,
        createdAt: new Date(),
      });
    });

    it('stores email message with all fields', async () => {
      prismaMock.emailMessage.create.mockResolvedValue({
        id: 'email-1',
        userId: 'user-1',
        messageId: 'msg-123',
        threadId: null,
        fromAddress: 'john@example.com',
        toAddresses: ['u_abc123@in.channelsignal.com', 'jane@company.com'],
        ccAddresses: [],
        subject: 'Test Email Subject',
        textBody: 'Hello world',
        htmlBody: '<p>Hello world</p>',
        sentAt: new Date('2024-01-15T10:00:00Z'),
        receivedAt: new Date(),
        dealId: null,
        meetingId: null,
      });

      await handleInboundEmail(basePayload);

      expect(prismaMock.emailMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          messageId: 'msg-123',
          fromAddress: 'john@example.com',
          subject: 'Test Email Subject',
          textBody: 'Hello world',
          htmlBody: '<p>Hello world</p>',
        }),
      });
    });

    it('handles duplicate message ID gracefully', async () => {
      const duplicateError = new Error('Unique constraint failed on the constraint: `EmailMessage_userId_messageId_key`');
      prismaMock.emailMessage.create.mockRejectedValue(duplicateError);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleInboundEmail(basePayload);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already processed')
      );

      consoleSpy.mockRestore();
    });

    it('rethrows non-duplicate errors', async () => {
      const otherError = new Error('Database connection failed');
      prismaMock.emailMessage.create.mockRejectedValue(otherError);

      await expect(handleInboundEmail(basePayload)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
