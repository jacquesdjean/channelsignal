import { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { Adapter } from 'next-auth/adapters';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    EmailProvider({
      server: {}, // Not used with custom sendVerificationRequest
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // In development without Resend API key, log magic link to console
        if (process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY) {
          console.log(`\n[DEV AUTH] Sign-in link for ${email}:\n${url}\n`);
          return;
        }

        if (!resend) {
          console.error('RESEND_API_KEY not configured');
          throw new Error('Email service not configured');
        }

        try {
          const result = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
            to: email,
            subject: 'Sign in to ChannelSignal',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #111; margin-bottom: 24px;">Sign in to ChannelSignal</h2>
                <p style="color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                  Click the button below to sign in. This link expires in 24 hours.
                </p>
                <a href="${url}"
                   style="display: inline-block; background: #2563eb; color: #fff;
                          padding: 12px 24px; text-decoration: none; border-radius: 6px;
                          font-weight: 500;">
                  Sign in to ChannelSignal
                </a>
                <p style="color: #666; font-size: 14px; margin-top: 32px;">
                  If you didn't request this email, you can safely ignore it.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
                <p style="color: #999; font-size: 12px;">
                  ChannelSignal - Email-native sales intelligence
                </p>
              </div>
            `,
          });

          console.log('Verification email sent:', result);
        } catch (error) {
          console.error('Failed to send verification email:', error);
          throw new Error('Failed to send verification email');
        }
      },
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};
