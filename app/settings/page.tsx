'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';

interface SystemStatus {
  database: { status: 'ok' | 'error'; message?: string; userCount?: number };
  email: { status: 'ok' | 'error'; mode: string };
  inbound: { status: 'ok' | 'error' };
}

interface Channel {
  id: string;
  name: string;
  bccSlug: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin');
    }
  }, [status]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [dbRes, channelsRes] = await Promise.all([
          fetch('/api/health/db'),
          fetch('/api/channels'),
        ]);

        const dbData = await dbRes.json();
        setSystemStatus({
          database: dbData,
          email: { status: 'ok', mode: 'dev (console)' },
          inbound: { status: 'ok' },
        });

        if (channelsRes.ok) {
          const channelData = await channelsRes.json();
          setChannels(channelData);
          if (channelData.length > 0) {
            setSelectedChannelId(channelData[0].id);
          }
        }
      } catch {
        setSystemStatus({
          database: { status: 'error', message: 'Failed to connect' },
          email: { status: 'error', mode: 'unknown' },
          inbound: { status: 'error' },
        });
      }
    };

    if (session) {
      fetchStatus();
    }
  }, [session]);

  const handleTestEmail = async () => {
    setTestEmailStatus('sending');
    try {
      const res = await fetch('/api/test-email', { method: 'POST' });
      if (res.ok) {
        setTestEmailStatus('success');
        setTimeout(() => setTestEmailStatus('idle'), 3000);
      } else {
        setTestEmailStatus('error');
      }
    } catch {
      setTestEmailStatus('error');
    }
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  if (status === 'loading') {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Email</span>
              <span className="text-gray-900">{session?.user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Name</span>
              <span className="text-gray-900">{session?.user?.name || '—'}</span>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">System Status</h2>
          <div className="space-y-3">
            <StatusRow
              label="Database"
              status={systemStatus?.database.status}
              detail={
                systemStatus?.database.status === 'ok'
                  ? `Connected (${systemStatus.database.userCount} users)`
                  : systemStatus?.database.message
              }
            />
            <StatusRow
              label="Email"
              status={systemStatus?.email.status}
              detail={systemStatus?.email.mode}
            />
            <StatusRow
              label="Inbound"
              status={systemStatus?.inbound.status}
              detail="Endpoint active"
            />
          </div>
        </div>

        {/* BCC Address */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Your BCC Address</h2>
          {channels.length === 0 ? (
            <p className="text-gray-500">No channels created yet. Create a channel to get a BCC address.</p>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor="channel-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Channel
                </label>
                <select
                  id="channel-select"
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedChannel && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-gray-100 rounded font-mono text-sm">
                    {selectedChannel.bccSlug}@channelsignal.dev
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${selectedChannel.bccSlug}@channelsignal.dev`)}
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  >
                    Copy
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Test Email */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Test Email</h2>
          <p className="text-gray-600 mb-4">
            Send a test email to verify the email system is working. In development mode, the magic link will be logged to the console.
          </p>
          <button
            onClick={handleTestEmail}
            disabled={testEmailStatus === 'sending'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {testEmailStatus === 'sending' ? 'Sending...' : 'Send Test Email'}
          </button>
          {testEmailStatus === 'success' && (
            <p className="mt-2 text-sm text-green-600">Test email logged to console!</p>
          )}
          {testEmailStatus === 'error' && (
            <p className="mt-2 text-sm text-red-600">Failed to send test email.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status?: 'ok' | 'error';
  detail?: string;
}) {
  return (
    <div className="flex items-center">
      <span className="w-4 h-4 mr-3">
        {status === 'ok' ? (
          <span className="text-green-500">&#10003;</span>
        ) : status === 'error' ? (
          <span className="text-red-500">&#10007;</span>
        ) : (
          <span className="text-gray-400">?</span>
        )}
      </span>
      <span className="text-gray-900">{label}</span>
      {detail && <span className="ml-2 text-gray-500 text-sm">({detail})</span>}
    </div>
  );
}
