import { describe, it, expect } from 'vitest';
import {
  parseEmailAddress,
  extractDomain,
  isPersonalDomain,
  extractThreadId,
  parseInboundEmail,
  extractContacts,
  classifyMeeting,
  type MeetingClassification,
} from '../parser';
import { InboundEmailPayload } from '../types';

describe('parseEmailAddress', () => {
  describe('named format: "Name <email>"', () => {
    it('parses standard named format', () => {
      const result = parseEmailAddress('John Doe <john@example.com>');
      expect(result).toEqual({ name: 'John Doe', email: 'john@example.com' });
    });

    it('parses quoted name format', () => {
      const result = parseEmailAddress('"Jane Smith" <jane@example.com>');
      expect(result).toEqual({ name: 'Jane Smith', email: 'jane@example.com' });
    });

    it('normalizes email to lowercase', () => {
      const result = parseEmailAddress('John Doe <JOHN@EXAMPLE.COM>');
      expect(result.email).toBe('john@example.com');
    });

    it('trims whitespace from name and email', () => {
      const result = parseEmailAddress('  John Doe  <  john@example.com  >');
      expect(result).toEqual({ name: 'John Doe', email: 'john@example.com' });
    });

    it('handles name with special characters', () => {
      const result = parseEmailAddress("O'Brien, James <james@example.com>");
      expect(result).toEqual({ name: "O'Brien, James", email: 'james@example.com' });
    });

    it('handles unicode characters in name', () => {
      const result = parseEmailAddress('José García <jose@example.com>');
      expect(result).toEqual({ name: 'José García', email: 'jose@example.com' });
    });

    it('handles empty name with angle brackets', () => {
      const result = parseEmailAddress('<john@example.com>');
      expect(result).toEqual({ name: null, email: 'john@example.com' });
    });
  });

  describe('plain email format', () => {
    it('parses plain email address', () => {
      const result = parseEmailAddress('john@example.com');
      expect(result).toEqual({ name: null, email: 'john@example.com' });
    });

    it('normalizes plain email to lowercase', () => {
      const result = parseEmailAddress('JOHN@EXAMPLE.COM');
      expect(result.email).toBe('john@example.com');
    });

    it('trims whitespace from plain email', () => {
      const result = parseEmailAddress('  john@example.com  ');
      expect(result.email).toBe('john@example.com');
    });

    it('handles subdomain emails', () => {
      const result = parseEmailAddress('john@mail.example.com');
      expect(result.email).toBe('john@mail.example.com');
    });
  });

  describe('edge cases', () => {
    it('handles email with plus addressing', () => {
      const result = parseEmailAddress('john+test@example.com');
      expect(result.email).toBe('john+test@example.com');
    });

    it('handles dots in local part', () => {
      const result = parseEmailAddress('john.doe.jr@example.com');
      expect(result.email).toBe('john.doe.jr@example.com');
    });
  });
});

describe('extractDomain', () => {
  it('extracts domain from valid email', () => {
    expect(extractDomain('john@example.com')).toBe('example.com');
  });

  it('extracts domain from subdomain email', () => {
    expect(extractDomain('john@mail.example.com')).toBe('mail.example.com');
  });

  it('normalizes domain to lowercase', () => {
    expect(extractDomain('john@EXAMPLE.COM')).toBe('example.com');
  });

  it('returns null for email without @', () => {
    expect(extractDomain('invalid-email')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(extractDomain('')).toBe(null);
  });

  it('handles email with multiple @ symbols (returns last part)', () => {
    // This is technically invalid, but test current behavior
    expect(extractDomain('weird@email@example.com')).toBe(null);
  });
});

describe('isPersonalDomain', () => {
  describe('returns true for personal domains', () => {
    const personalDomains = [
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
    ];

    personalDomains.forEach((domain) => {
      it(`identifies ${domain} as personal`, () => {
        expect(isPersonalDomain(domain)).toBe(true);
      });
    });

    it('handles uppercase personal domains', () => {
      expect(isPersonalDomain('GMAIL.COM')).toBe(true);
      expect(isPersonalDomain('Yahoo.Com')).toBe(true);
    });
  });

  describe('returns false for corporate domains', () => {
    const corporateDomains = [
      'acme.com',
      'example.com',
      'company.io',
      'startup.co',
      'enterprise.org',
    ];

    corporateDomains.forEach((domain) => {
      it(`identifies ${domain} as corporate`, () => {
        expect(isPersonalDomain(domain)).toBe(false);
      });
    });
  });

  describe('handles edge cases', () => {
    it('returns true for null domain', () => {
      expect(isPersonalDomain(null)).toBe(true);
    });

    it('returns true for empty string (treated as invalid/personal)', () => {
      // Empty string is falsy, so it's treated like null for safety
      expect(isPersonalDomain('')).toBe(true);
    });
  });
});

describe('extractThreadId', () => {
  it('extracts thread ID from In-Reply-To header', () => {
    const headers = {
      'in-reply-to': '<abc123@example.com>',
    };
    expect(extractThreadId(headers)).toBe('abc123@example.com');
  });

  it('strips angle brackets from In-Reply-To', () => {
    const headers = {
      'in-reply-to': '<message-id-123>',
    };
    expect(extractThreadId(headers)).toBe('message-id-123');
  });

  it('falls back to References when In-Reply-To is missing', () => {
    const headers = {
      references: '<first@example.com> <second@example.com>',
    };
    expect(extractThreadId(headers)).toBe('first@example.com');
  });

  it('prefers In-Reply-To over References', () => {
    const headers = {
      'in-reply-to': '<reply-to@example.com>',
      references: '<ref1@example.com> <ref2@example.com>',
    };
    expect(extractThreadId(headers)).toBe('reply-to@example.com');
  });

  it('returns null when no thread headers present', () => {
    const headers = {
      from: 'John <john@example.com>',
      to: 'Jane <jane@example.com>',
    };
    expect(extractThreadId(headers)).toBe(null);
  });

  it('returns null for undefined headers', () => {
    expect(extractThreadId(undefined)).toBe(null);
  });

  it('handles empty headers object', () => {
    expect(extractThreadId({})).toBe(null);
  });
});

describe('parseInboundEmail', () => {
  const basePayload: InboundEmailPayload = {
    messageId: 'msg-123',
    from: 'John Doe <john@example.com>',
    to: ['jane@company.com'],
    subject: 'Test Subject',
    textBody: 'Hello world',
    htmlBody: '<p>Hello world</p>',
    sentAt: '2024-01-15T10:00:00Z',
  };

  it('parses a complete email payload', () => {
    const result = parseInboundEmail(basePayload);

    expect(result.messageId).toBe('msg-123');
    expect(result.fromAddress).toBe('john@example.com');
    expect(result.fromName).toBe('John Doe');
    expect(result.toAddresses).toEqual(['jane@company.com']);
    expect(result.subject).toBe('Test Subject');
    expect(result.textBody).toBe('Hello world');
    expect(result.htmlBody).toBe('<p>Hello world</p>');
    expect(result.sentAt).toEqual(new Date('2024-01-15T10:00:00Z'));
  });

  it('handles CC addresses', () => {
    const payload: InboundEmailPayload = {
      ...basePayload,
      cc: ['cc1@example.com', 'CC2 <cc2@example.com>'],
    };
    const result = parseInboundEmail(payload);

    expect(result.ccAddresses).toEqual(['cc1@example.com', 'cc2@example.com']);
  });

  it('returns empty CC array when not provided', () => {
    const result = parseInboundEmail(basePayload);
    expect(result.ccAddresses).toEqual([]);
  });

  it('extracts BCC recipient matching app format', () => {
    const payload: InboundEmailPayload = {
      ...basePayload,
      bcc: ['other@example.com', 'u_abc123@in.channelsignal.com'],
    };
    const result = parseInboundEmail(payload);

    expect(result.bccRecipient).toBe('u_abc123@in.channelsignal.com');
  });

  it('returns null BCC recipient when none match app format', () => {
    const payload: InboundEmailPayload = {
      ...basePayload,
      bcc: ['regular@example.com'],
    };
    const result = parseInboundEmail(payload);

    expect(result.bccRecipient).toBe(null);
  });

  it('extracts thread ID from headers', () => {
    const payload: InboundEmailPayload = {
      ...basePayload,
      headers: {
        'in-reply-to': '<thread-123@example.com>',
      },
    };
    const result = parseInboundEmail(payload);

    expect(result.threadId).toBe('thread-123@example.com');
  });

  it('uses current date when sentAt is not provided', () => {
    const payload: InboundEmailPayload = {
      ...basePayload,
      sentAt: undefined,
    };
    const before = new Date();
    const result = parseInboundEmail(payload);
    const after = new Date();

    expect(result.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('handles missing text and HTML body', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['jane@example.com'],
      subject: 'Empty email',
    };
    const result = parseInboundEmail(payload);

    expect(result.textBody).toBe(null);
    expect(result.htmlBody).toBe(null);
  });
});

describe('extractContacts', () => {
  it('extracts sender as contact', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'John Doe <john@example.com>',
      to: ['jane@company.com'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    expect(contacts).toContainEqual({
      email: 'john@example.com',
      name: 'John Doe',
      domain: 'example.com',
    });
  });

  it('extracts To recipients', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['Jane Smith <jane@company.com>', 'bob@other.org'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    expect(contacts).toContainEqual({
      email: 'jane@company.com',
      name: 'Jane Smith',
      domain: 'company.com',
    });
    expect(contacts).toContainEqual({
      email: 'bob@other.org',
      name: null,
      domain: 'other.org',
    });
  });

  it('extracts CC recipients', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['jane@company.com'],
      cc: ['cc@other.com'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    expect(contacts).toContainEqual({
      email: 'cc@other.com',
      name: null,
      domain: 'other.com',
    });
  });

  it('removes duplicate email addresses', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['john@example.com', 'jane@company.com'],
      cc: ['john@example.com'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    const johnContacts = contacts.filter((c) => c.email === 'john@example.com');
    expect(johnContacts).toHaveLength(1);
  });

  it('filters out app BCC addresses from To', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['u_abc123@in.channelsignal.com', 'jane@company.com'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    expect(contacts.map((c) => c.email)).not.toContain(
      'u_abc123@in.channelsignal.com'
    );
    expect(contacts.map((c) => c.email)).toContain('jane@company.com');
  });

  it('filters out app BCC addresses from CC', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['jane@company.com'],
      cc: ['u_xyz789@in.app.io'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    const appContacts = contacts.filter((c) =>
      c.email.startsWith('u_') && c.email.includes('@in.')
    );
    expect(appContacts).toHaveLength(0);
  });

  it('handles empty CC array', () => {
    const payload: InboundEmailPayload = {
      messageId: 'msg-123',
      from: 'john@example.com',
      to: ['jane@company.com'],
      subject: 'Test',
    };
    const contacts = extractContacts(payload);

    expect(contacts).toHaveLength(2);
  });
});

describe('classifyMeeting', () => {
  describe('QBR classification', () => {
    const qbrSubjects = [
      'Q3 QBR with Acme Corp',
      'qbr - Acme Corp',
      'QBR Q4 2024',
      'Quarterly Business Review - Acme',
      'QUARTERLY BUSINESS REVIEW',
      'quarterly business review with team',
    ];

    qbrSubjects.forEach((subject) => {
      it(`classifies "${subject}" as QBR`, () => {
        expect(classifyMeeting(subject)).toBe('QBR');
      });
    });
  });

  describe('Annual Review classification', () => {
    const annualSubjects = [
      'Annual Review 2024',
      'annual review - Acme Corp',
      'Yearly Review Meeting',
      'yearly review',
      'ANNUAL REVIEW',
    ];

    annualSubjects.forEach((subject) => {
      it(`classifies "${subject}" as ANNUAL_REVIEW`, () => {
        expect(classifyMeeting(subject)).toBe('ANNUAL_REVIEW');
      });
    });
  });

  describe('Weekly Check-in classification', () => {
    const weeklySubjects = [
      'Weekly sync with team',
      'Weekly Sync - Acme',
      'weekly check-in',
      'Weekly Check-In Meeting',
      'weekly checkin',
      'Weekly meeting - Project X',
      'Weekly call with partner',
    ];

    weeklySubjects.forEach((subject) => {
      it(`classifies "${subject}" as WEEKLY_CHECKIN`, () => {
        expect(classifyMeeting(subject)).toBe('WEEKLY_CHECKIN');
      });
    });
  });

  describe('Deal Review classification', () => {
    const dealSubjects = [
      'Deal Review - Acme Contract',
      'deal review',
      'Pipeline Review Q4',
      'pipeline review meeting',
      'DEAL REVIEW',
    ];

    dealSubjects.forEach((subject) => {
      it(`classifies "${subject}" as DEAL_REVIEW`, () => {
        expect(classifyMeeting(subject)).toBe('DEAL_REVIEW');
      });
    });
  });

  describe('OTHER meeting classification', () => {
    const otherMeetingSubjects = [
      'Monthly sync - Acme',
      'monthly meeting with team',
      'Monthly call scheduled',
    ];

    otherMeetingSubjects.forEach((subject) => {
      it(`classifies "${subject}" as OTHER`, () => {
        expect(classifyMeeting(subject)).toBe('OTHER');
      });
    });
  });

  describe('Non-meeting classification', () => {
    const nonMeetingSubjects = [
      'Invoice #12345',
      'Re: Your order has shipped',
      'Question about your product',
      'Following up on our conversation',
      'Contract signed - next steps',
      'Thank you for your business',
      '',
    ];

    nonMeetingSubjects.forEach((subject) => {
      it(`returns null for "${subject || '(empty)'}"`, () => {
        expect(classifyMeeting(subject)).toBe(null);
      });
    });
  });

  describe('case insensitivity', () => {
    it('handles mixed case QBR', () => {
      expect(classifyMeeting('QbR Meeting')).toBe('QBR');
    });

    it('handles all caps subjects', () => {
      expect(classifyMeeting('WEEKLY SYNC CALL')).toBe('WEEKLY_CHECKIN');
    });

    it('handles all lowercase subjects', () => {
      expect(classifyMeeting('quarterly business review')).toBe('QBR');
    });
  });
});
