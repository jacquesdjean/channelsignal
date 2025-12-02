import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { generateWeeklyReport, getDefaultWeeklyPeriod } from '@/lib/reports/weekly';

/**
 * POST /api/reports/weekly
 * Generate a new weekly report
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Parse dates or use defaults
    let start: Date;
    let end: Date;

    if (body.start && body.end) {
      start = new Date(body.start);
      end = new Date(body.end);
    } else {
      const period = getDefaultWeeklyPeriod();
      start = period.start;
      end = period.end;
    }

    const report = await generateWeeklyReport(session.user.id, start, end);

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
