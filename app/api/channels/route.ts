import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const channels = await prisma.channel.findMany({
      include: {
        organization: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error('Failed to fetch channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, bccSlug, description, organizationId } = body;

    if (!name || !bccSlug || !organizationId) {
      return NextResponse.json(
        { error: 'name, bccSlug, and organizationId are required' },
        { status: 400 }
      );
    }

    // Check if bccSlug is unique
    const existing = await prisma.channel.findUnique({
      where: { bccSlug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'BCC slug already in use' },
        { status: 400 }
      );
    }

    const channel = await prisma.channel.create({
      data: {
        name,
        bccSlug,
        description,
        organizationId,
      },
      include: {
        organization: true,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    console.error('Failed to create channel:', error);
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
  }
}
