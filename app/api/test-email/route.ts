import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // In development, just log to console
  console.log(`\n[DEV TEST EMAIL] Test email triggered by ${session.user.email}\n`);
  console.log(`If email was configured, a magic link would be sent to: ${session.user.email}\n`);

  return NextResponse.json({
    success: true,
    message: 'Test email logged to console (dev mode)'
  });
}
