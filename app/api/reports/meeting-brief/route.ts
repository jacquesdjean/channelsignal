import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { generateMeetingBrief } from '@/lib/reports/meeting-brief';

/**
 * POST /api/reports/meeting-brief
 * Generate a meeting brief report
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.meetingId) {
      return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });
    }

    const report = await generateMeetingBrief(session.user.id, body.meetingId);

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error generating meeting brief:', error);

    if (error instanceof Error && error.message === 'Meeting not found') {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
