import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { formatDistanceToNow } from 'date-fns';

export default async function ChannelsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  const channels = await prisma.channel.findMany({
    include: {
      organization: true,
      _count: {
        select: { emailEvents: true },
      },
      emailEvents: {
        orderBy: { timestamp: 'desc' },
        take: 1,
        select: { timestamp: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const isEmpty = channels.length === 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
          <Link
            href="/channels/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Channel
          </Link>
        </div>

        {isEmpty ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <GitBranchIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No channels yet</h3>
            <p className="mt-2 text-gray-500">
              Create your first channel to start tracking emails.
            </p>
            <Link
              href="/channels/new"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Channel
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => {
              const lastActivity = channel.emailEvents[0]?.timestamp;
              return (
                <Link
                  key={channel.id}
                  href={`/channels/${channel.id}`}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{channel.name}</h3>
                      <p className="text-sm text-gray-500">{channel.organization.name}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        channel.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : channel.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {channel.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>{channel._count.emailEvents} emails</span>
                    {lastActivity && (
                      <span>
                        Last activity {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <code className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                      {channel.bccSlug}@channelsignal.dev
                    </code>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12M6 15a3 3 0 103 3M18 9a3 3 0 10-3-3M18 9v6a3 3 0 01-3 3H9" />
    </svg>
  );
}
