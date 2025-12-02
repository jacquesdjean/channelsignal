import { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { Adapter, AdapterUser } from 'next-auth/adapters';
import { prisma } from '@/lib/db';
import { createId } from '@paralleldrive/cuid2';

const INBOUND_EMAIL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'in.channelsignal.app';

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
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT) || 587,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || 'noreply@channelsignal.app',
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
