import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ChannelSignal <onboarding@resend.dev>';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const { to, subject, html, text } = options;

  // Dev mode: log to console instead of sending
  if (!resend) {
    console.log('\n========== EMAIL (Dev Mode) ==========');
    console.log(`To: ${to}`);
    console.log(`From: ${EMAIL_FROM}`);
    console.log(`Subject: ${subject}`);
    console.log('------- HTML -------');
    console.log(html);
    if (text) {
      console.log('------- Text -------');
      console.log(text);
    }
    console.log('=====================================\n');
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Email send error:', message);
    return { success: false, error: message };
  }
}

// Email Templates

export async function sendWelcomeEmail(email: string, name?: string): Promise<EmailResult> {
  const displayName = name || 'there';

  return sendEmail({
    to: email,
    subject: 'Welcome to ChannelSignal',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; margin-bottom: 24px;">Welcome to ChannelSignal!</h1>
          <p>Hi ${displayName},</p>
          <p>Thanks for signing up for ChannelSignal. You're now ready to start tracking your channel sales activity.</p>
          <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 32px;">Getting Started</h2>
          <ul style="padding-left: 20px;">
            <li>Create a channel to start tracking deals</li>
            <li>Use the BCC address to automatically capture email activity</li>
            <li>Upload files to attach them to your channels</li>
            <li>Check your inbox for captured email events</li>
          </ul>
          <p style="margin-top: 32px;">If you have any questions, just reply to this email.</p>
          <p style="color: #666; margin-top: 32px;">— The ChannelSignal Team</p>
        </body>
      </html>
    `,
    text: `Welcome to ChannelSignal!

Hi ${displayName},

Thanks for signing up for ChannelSignal. You're now ready to start tracking your channel sales activity.

Getting Started:
- Create a channel to start tracking deals
- Use the BCC address to automatically capture email activity
- Upload files to attach them to your channels
- Check your inbox for captured email events

If you have any questions, just reply to this email.

— The ChannelSignal Team`,
  });
}

export async function sendTestConfirmationEmail(email: string): Promise<EmailResult> {
  return sendEmail({
    to: email,
    subject: 'ChannelSignal - Test Email Confirmation',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; margin-bottom: 24px;">Test Email Received!</h1>
          <p>This is a test email from ChannelSignal.</p>
          <p>If you're seeing this, your email configuration is working correctly.</p>
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #0369a1;"><strong>Status:</strong> Email delivery confirmed</p>
            <p style="margin: 8px 0 0 0; color: #0369a1;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          <p style="color: #666; margin-top: 32px;">— ChannelSignal</p>
        </body>
      </html>
    `,
    text: `Test Email Received!

This is a test email from ChannelSignal.

If you're seeing this, your email configuration is working correctly.

Status: Email delivery confirmed
Timestamp: ${new Date().toISOString()}

— ChannelSignal`,
  });
}

export async function sendUploadNotificationEmail(
  email: string,
  fileName: string,
  fileSize: number,
  channelName?: string
): Promise<EmailResult> {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const channelInfo = channelName ? ` to channel "${channelName}"` : '';

  return sendEmail({
    to: email,
    subject: `ChannelSignal - File Uploaded: ${fileName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; margin-bottom: 24px;">File Upload Confirmation</h1>
          <p>Your file has been successfully uploaded${channelInfo}.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0;"><strong>File:</strong> ${fileName}</p>
            <p style="margin: 8px 0 0 0;"><strong>Size:</strong> ${formatBytes(fileSize)}</p>
            ${channelName ? `<p style="margin: 8px 0 0 0;"><strong>Channel:</strong> ${channelName}</p>` : ''}
            <p style="margin: 8px 0 0 0;"><strong>Uploaded:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>You can view your uploads in the <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/uploads" style="color: #2563eb;">Uploads page</a>.</p>
          <p style="color: #666; margin-top: 32px;">— ChannelSignal</p>
        </body>
      </html>
    `,
    text: `File Upload Confirmation

Your file has been successfully uploaded${channelInfo}.

File: ${fileName}
Size: ${formatBytes(fileSize)}
${channelName ? `Channel: ${channelName}\n` : ''}Uploaded: ${new Date().toLocaleString()}

You can view your uploads at ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/uploads

— ChannelSignal`,
  });
}
