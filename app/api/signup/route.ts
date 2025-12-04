import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { sendWelcomeEmail } from '@/lib/email';

interface SignupBody {
  email: string;
  name?: string;
  organizationName?: string;
}

/**
 * POST /api/signup
 *
 * Create a new user account with optional organization
 *
 * Request body: { email: string, name?: string, organizationName?: string }
 *
 * If organizationName is provided, creates an Organization and Membership with OWNER role.
 * Sends a welcome email to the user.
 */
export async function POST(request: NextRequest) {
  try {
    const body: SignupBody = await request.json();
    const { email, name, organizationName } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create user (and optionally organization with membership) in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name: name || null,
        },
      });

      let organization = null;
      let membership = null;

      // If organizationName is provided, create organization and membership
      if (organizationName && organizationName.trim()) {
        organization = await tx.organization.create({
          data: {
            name: organizationName.trim(),
          },
        });

        membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: 'owner',
          },
        });
      }

      return { user, organization, membership };
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch((error) => {
      console.error('Failed to send welcome email:', error);
    });

    return NextResponse.json(
      {
        userId: result.user.id,
        organizationId: result.organization?.id || null,
        message: 'User created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
