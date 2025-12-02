import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db';

/**
 * GET /api/reports
 * List all reports for the current user
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const reports = await prisma.report.findMany({
      where: {
        userId: session.user.id,
        ...(type && { type: type as 'WEEKLY' | 'MEETING_BRIEF' | 'QUARTERLY' | 'ANNUAL' }),
      },
      orderBy: { generatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        periodStart: true,
        periodEnd: true,
        meetingId: true,
        generatedAt: true,
        meeting: {
          select: {
            title: true,
          },
        },
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
