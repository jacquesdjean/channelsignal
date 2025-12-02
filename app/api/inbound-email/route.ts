import { NextRequest, NextResponse } from 'next/server';
import { handleInboundEmail } from '@/lib/ingestion/handler';
import { InboundEmailPayload } from '@/lib/ingestion/types';

// Webhook secret for validation (should be set in env)
const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

/**
 * POST /api/inbound-email
 *
 * Webhook endpoint for receiving inbound emails from providers like Resend or Postmark.
 * This endpoint accepts the raw email payload and processes it.
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Validate webhook signature
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get('x-webhook-signature');
      // Add signature validation here based on your provider
      // For now, we just check if a secret is configured
      if (!signature) {
        console.warn('No webhook signature provided');
      }
    }

    const body = await request.json();

    // Transform provider-specific payload to our format
    // This example handles a generic/Resend-like format
    const payload = transformPayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 }
      );
    }

    // Process the email asynchronously
    // In production, you'd want to queue this
    await handleInboundEmail(payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Failed to process email' },
      { status: 500 }
    );
  }
}

/**
 * Transforms provider-specific payload to our standard format
 * Extend this function to support different providers (Resend, Postmark, SendGrid, etc.)
 */
function transformPayload(body: Record<string, unknown>): InboundEmailPayload | null {
  // Resend format
  if (body.type === 'email.received' && body.data) {
    const data = body.data as Record<string, unknown>;
    return {
      messageId: data.email_id as string || generateMessageId(),
      from: data.from as string,
      to: Array.isArray(data.to) ? data.to : [data.to as string],
      cc: data.cc as string[] | undefined,
      bcc: data.bcc as string[] | undefined,
      subject: data.subject as string || '(no subject)',
      textBody: data.text as string | undefined,
      htmlBody: data.html as string | undefined,
      sentAt: data.created_at as string | undefined,
      headers: data.headers as Record<string, string> | undefined,
    };
  }

  // Postmark format
  if (body.MessageID || body.OriginalRecipient) {
    return {
      messageId: body.MessageID as string || generateMessageId(),
      from: body.From as string,
      to: Array.isArray(body.To) ? body.To : (body.To as string).split(',').map(s => s.trim()),
      cc: body.Cc ? (body.Cc as string).split(',').map(s => s.trim()) : undefined,
      bcc: body.Bcc ? (body.Bcc as string).split(',').map(s => s.trim()) : undefined,
      subject: body.Subject as string || '(no subject)',
      textBody: body.TextBody as string | undefined,
      htmlBody: body.HtmlBody as string | undefined,
      sentAt: body.Date as string | undefined,
      headers: convertPostmarkHeaders(body.Headers as Array<{Name: string; Value: string}> | undefined),
    };
  }

  // Generic/direct format (for testing)
  if (body.from && body.to) {
    return {
      messageId: body.messageId as string || generateMessageId(),
      from: body.from as string,
      to: Array.isArray(body.to) ? body.to : [body.to as string],
      cc: body.cc as string[] | undefined,
      bcc: body.bcc as string[] | undefined,
      subject: body.subject as string || '(no subject)',
      textBody: body.textBody as string || body.text as string,
      htmlBody: body.htmlBody as string || body.html as string,
      sentAt: body.sentAt as string || body.date as string,
      headers: body.headers as Record<string, string> | undefined,
    };
  }

  return null;
}

function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function convertPostmarkHeaders(
  headers: Array<{Name: string; Value: string}> | undefined
): Record<string, string> | undefined {
  if (!headers) return undefined;
  return headers.reduce((acc, h) => {
    acc[h.Name.toLowerCase()] = h.Value;
    return acc;
  }, {} as Record<string, string>);
}
