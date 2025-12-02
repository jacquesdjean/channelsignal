import { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { Adapter, AdapterUser } from 'next-auth/adapters';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { createId } from '@paralleldrive/cuid2';

const INBOUND_EMAIL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'in.channelsignal.app';

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function generateBccAddress(): string {
  const uniqueId = createId();
  return `u_${uniqueId}@${INBOUND_EMAIL_DOMAIN}`;
}

// Custom adapter that sets bccAddress on user creation
const customPrismaAdapter = (): Adapter => {
  const adapter = PrismaAdapter(prisma) as Adapter;

  return {
    ...adapter,
    createUser: async (data: Omit<AdapterUser, 'id'>): Promise<AdapterUser> => {
      const bccAddress = generateBccAddress();
      const user = await prisma.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name,
          image: data.image,
          bccAddress,
        },
      });
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      };
    },
  };
};

export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter(),
  providers: [
    EmailProvider({
      server: {}, // Not used with custom sendVerificationRequest
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      sendVerificationRequest: async ({ identifier: email, url }) => {
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
        // Fetch bccAddress from the user record
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { bccAddress: true },
        });
        session.user.bccAddress = dbUser?.bccAddress || '';
      }
      return session;
    },
  },
};
