import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface InboundEmailPayload {
  bccSlug: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyStub?: string;
  timestamp: string;
  externalId?: string;
}

/**
 * POST /api/inbound/email
 *
 * Accepts inbound email data and creates an EmailEvent record.
 *
 * Request body:
 * {
 *   "bccSlug": "acme-q4-renewal",
 *   "from": "rep@example.com",
 *   "to": ["buyer@acme.com"],
 *   "cc": [],
 *   "subject": "Q4 renewal discussion",
 *   "bodyStub": "Hi team, following up on...",
 *   "timestamp": "2025-01-15T14:30:00Z",
 *   "externalId": "message-id-header-value"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: InboundEmailPayload = await request.json();

    // Validate required fields
    if (!body.bccSlug) {
      return NextResponse.json({ error: 'bccSlug is required' }, { status: 400 });
    }
    if (!body.from) {
      return NextResponse.json({ error: 'from is required' }, { status: 400 });
    }
    if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
      return NextResponse.json({ error: 'to is required and must be a non-empty array' }, { status: 400 });
    }
    if (!body.subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }
    if (!body.timestamp) {
      return NextResponse.json({ error: 'timestamp is required' }, { status: 400 });
    }

    // Find the channel by bccSlug
    const channel = await prisma.channel.findUnique({
      where: { bccSlug: body.bccSlug },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Check for duplicate based on externalId
    if (body.externalId) {
      const existing = await prisma.emailEvent.findFirst({
        where: {
          channelId: channel.id,
          externalId: body.externalId,
        },
      });

      if (existing) {
        // Return existing ID instead of creating duplicate
        return NextResponse.json({ id: existing.id }, { status: 201 });
      }
    }

    // Create the EmailEvent
    const emailEvent = await prisma.emailEvent.create({
      data: {
        channelId: channel.id,
        fromAddr: body.from,
        toAddrs: body.to,
        ccAddrs: body.cc || [],
        subject: body.subject,
        bodyStub: body.bodyStub?.substring(0, 500), // Limit to 500 chars
        externalId: body.externalId,
        timestamp: new Date(body.timestamp),
      },
    });

    return NextResponse.json({ id: emailEvent.id }, { status: 201 });
  } catch (error) {
    console.error('Error processing inbound email:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
