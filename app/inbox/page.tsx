import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { formatDistanceToNow } from 'date-fns';
import type { EmailEvent, Channel, Organization } from '@prisma/client';

type EmailEventWithChannel = EmailEvent & {
  channel: Channel & { organization: Organization };
};

type ChannelGroup = {
  channel: Channel & { organization: Organization };
  events: EmailEventWithChannel[];
};

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  // Get email events from channels the user has access to via memberships
  const emailEvents: EmailEventWithChannel[] = await prisma.emailEvent.findMany({
    include: {
      channel: {
        include: {
          organization: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  // Group by channel
  const groupedByChannel = emailEvents.reduce<Record<string, ChannelGroup>>((acc, event) => {
    const channelId = event.channelId;
    if (!acc[channelId]) {
      acc[channelId] = {
        channel: event.channel,
        events: [],
      };
    }
    acc[channelId].events.push(event);
    return acc;
  }, {});

  const isEmpty = emailEvents.length === 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>

        {isEmpty ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <MailIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No emails yet</h3>
            <p className="mt-2 text-gray-500">
              BCC your first email to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByChannel).map(([channelId, { channel, events }]: [string, ChannelGroup]) => (
              <div key={channelId} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-medium text-gray-700">
                    {channel.name}
                    <span className="ml-2 text-gray-400">({channel.organization.name})</span>
                  </h2>
                </div>
                <ul className="divide-y divide-gray-200">
                  {events.map((event: EmailEventWithChannel) => (
                    <li key={event.id} className="px-4 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {event.subject}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            From: {event.fromAddr}
                          </p>
                          {event.bodyStub && (
                            <p className="mt-1 text-sm text-gray-400 truncate">
                              {event.bodyStub}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0 text-sm text-gray-400">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}
