import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the handler module
const mockHandleInboundEmail = vi.fn();
vi.mock('@/lib/ingestion/handler', () => ({
  handleInboundEmail: mockHandleInboundEmail,
}));

// Import after mock setup
const { POST } = await import('../route');

describe('POST /api/inbound-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleInboundEmail.mockResolvedValue(undefined);
  });

  function createRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/inbound-email', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  describe('Resend payload format', () => {
    it('processes Resend email.received event', async () => {
      const payload = {
        type: 'email.received',
        data: {
          email_id: 'resend-msg-123',
          from: 'sender@example.com',
          to: ['recipient@company.com'],
          subject: 'Test Email',
          text: 'Hello world',
          html: '<p>Hello world</p>',
          created_at: '2024-01-15T10:00:00Z',
        },
      };

      const request = createRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'resend-msg-123',
          from: 'sender@example.com',
          to: ['recipient@company.com'],
          subject: 'Test Email',
          textBody: 'Hello world',
          htmlBody: '<p>Hello world</p>',
        })
      );
    });

    it('handles Resend payload with CC and BCC', async () => {
      const payload = {
        type: 'email.received',
        data: {
          email_id: 'resend-msg-456',
          from: 'sender@example.com',
          to: ['recipient@company.com'],
          cc: ['cc@company.com'],
          bcc: ['u_abc123@in.channelsignal.com'],
          subject: 'CC Test',
          text: 'With CC',
        },
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc@company.com'],
          bcc: ['u_abc123@in.channelsignal.com'],
        })
      );
    });

    it('generates message ID if not provided by Resend', async () => {
      const payload = {
        type: 'email.received',
        data: {
          from: 'sender@example.com',
          to: ['recipient@company.com'],
          subject: 'No Message ID',
          text: 'Content',
        },
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.stringMatching(/^\d+-[a-z0-9]+$/),
        })
      );
    });
  });

  describe('Postmark payload format', () => {
    it('processes Postmark inbound email', async () => {
      const payload = {
        MessageID: 'postmark-msg-789',
        From: 'John Doe <john@example.com>',
        To: 'recipient@company.com',
        Subject: 'Postmark Test',
        TextBody: 'Postmark text',
        HtmlBody: '<p>Postmark HTML</p>',
        Date: '2024-01-15T10:00:00Z',
      };

      const request = createRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'postmark-msg-789',
          from: 'John Doe <john@example.com>',
          subject: 'Postmark Test',
          textBody: 'Postmark text',
          htmlBody: '<p>Postmark HTML</p>',
        })
      );
    });

    it('handles Postmark comma-separated To addresses', async () => {
      const payload = {
        MessageID: 'postmark-msg-multi',
        From: 'sender@example.com',
        To: 'first@company.com, second@company.com',
        Subject: 'Multiple Recipients',
        TextBody: 'Content',
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['first@company.com', 'second@company.com'],
        })
      );
    });

    it('handles Postmark CC and BCC as comma-separated strings', async () => {
      const payload = {
        MessageID: 'postmark-msg-cc',
        From: 'sender@example.com',
        To: 'recipient@company.com',
        Cc: 'cc1@test.com, cc2@test.com',
        Bcc: 'bcc@test.com',
        Subject: 'With CC',
        TextBody: 'Content',
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc1@test.com', 'cc2@test.com'],
          bcc: ['bcc@test.com'],
        })
      );
    });

    it('converts Postmark headers array to object', async () => {
      const payload = {
        MessageID: 'postmark-headers',
        From: 'sender@example.com',
        To: 'recipient@company.com',
        Subject: 'With Headers',
        TextBody: 'Content',
        Headers: [
          { Name: 'In-Reply-To', Value: '<thread-123@example.com>' },
          { Name: 'X-Custom', Value: 'custom-value' },
        ],
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'in-reply-to': '<thread-123@example.com>',
            'x-custom': 'custom-value',
          },
        })
      );
    });

    it('detects Postmark by OriginalRecipient field', async () => {
      const payload = {
        OriginalRecipient: 'inbox@example.com',
        From: 'sender@example.com',
        To: 'recipient@company.com',
        Subject: 'Postmark by OriginalRecipient',
        TextBody: 'Content',
      };

      const request = createRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockHandleInboundEmail).toHaveBeenCalled();
    });
  });

  describe('Generic/direct payload format', () => {
    it('processes generic payload format', async () => {
      const payload = {
        messageId: 'generic-msg-001',
        from: 'sender@example.com',
        to: ['recipient@company.com'],
        subject: 'Generic Test',
        textBody: 'Generic text body',
        htmlBody: '<p>Generic HTML</p>',
        sentAt: '2024-01-15T10:00:00Z',
      };

      const request = createRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'generic-msg-001',
          from: 'sender@example.com',
          to: ['recipient@company.com'],
          subject: 'Generic Test',
        })
      );
    });

    it('handles alternative field names (text, html, date)', async () => {
      const payload = {
        from: 'sender@example.com',
        to: ['recipient@company.com'],
        subject: 'Alt Fields',
        text: 'Using text instead of textBody',
        html: '<p>Using html instead of htmlBody</p>',
        date: '2024-01-15T10:00:00Z',
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          textBody: 'Using text instead of textBody',
          htmlBody: '<p>Using html instead of htmlBody</p>',
          sentAt: '2024-01-15T10:00:00Z',
        })
      );
    });

    it('wraps single to address in array', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'single@company.com',
        subject: 'Single recipient',
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['single@company.com'],
        })
      );
    });
  });

  describe('Error handling', () => {
    it('returns 400 for invalid payload format', async () => {
      const payload = {
        invalid: 'This has no from or to fields',
      };

      const request = createRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload format');
      expect(mockHandleInboundEmail).not.toHaveBeenCalled();
    });

    it('returns 400 for empty payload', async () => {
      const request = createRequest({});
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockHandleInboundEmail).not.toHaveBeenCalled();
    });

    it('returns 500 when handler throws error', async () => {
      mockHandleInboundEmail.mockRejectedValue(new Error('Database connection failed'));

      const payload = {
        from: 'sender@example.com',
        to: ['recipient@company.com'],
        subject: 'Will fail',
      };

      const request = createRequest(payload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process email');
    });
  });

  describe('Default values', () => {
    it('uses "(no subject)" for missing subject', async () => {
      const payload = {
        from: 'sender@example.com',
        to: ['recipient@company.com'],
        // No subject
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '(no subject)',
        })
      );
    });

    it('uses "(no subject)" for Resend payload without subject', async () => {
      const payload = {
        type: 'email.received',
        data: {
          from: 'sender@example.com',
          to: ['recipient@company.com'],
          text: 'No subject email',
        },
      };

      const request = createRequest(payload);
      await POST(request);

      expect(mockHandleInboundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '(no subject)',
        })
      );
    });
  });
});
