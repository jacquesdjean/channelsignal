import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { CopyButton } from '@/components/CopyButton';
import { formatDistanceToNow } from 'date-fns';
import type { EmailEvent, Upload, User } from '@prisma/client';

interface Props {
  params: { id: string };
}

export default async function ChannelDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  const channel = await prisma.channel.findUnique({
    where: { id: params.id },
    include: {
      organization: true,
      emailEvents: {
        orderBy: { timestamp: 'desc' },
        take: 50,
      },
      uploads: {
        include: { uploadedBy: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!channel) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/channels" className="text-sm text-gray-500 hover:text-gray-700">
              &larr; Back to Channels
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{channel.name}</h1>
            <p className="text-gray-500">{channel.organization.name}</p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
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

        {/* BCC Address */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">BCC Address</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
              {channel.bccSlug}@channelsignal.dev
            </code>
            <CopyButton text={`${channel.bccSlug}@channelsignal.dev`} />
          </div>
        </div>

        {/* Description */}
        {channel.description && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Description</h2>
            <p className="text-gray-600">{channel.description}</p>
          </div>
        )}

        {/* Email Events */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">
              Recent Emails ({channel.emailEvents.length})
            </h2>
          </div>
          {channel.emailEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No emails received yet. BCC this channel to start tracking.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {channel.emailEvents.map((event: EmailEvent) => (
                <li key={event.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {event.subject}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        From: {event.fromAddr} &rarr; To: {event.toAddrs.join(', ')}
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
          )}
        </div>

        {/* Uploads */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">
              Uploads ({channel.uploads.length})
            </h2>
          </div>
          {channel.uploads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No uploads yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {channel.uploads.map((upload: Upload & { uploadedBy: User | null }) => (
                <li key={upload.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{upload.filename}</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(upload.sizeBytes)} &bull; Uploaded by {upload.uploadedBy?.email || 'Unknown'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(upload.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
