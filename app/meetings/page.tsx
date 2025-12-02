'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  meetingType: string | null;
  scheduledAt: string | null;
  createdAt: string;
  org: {
    name: string;
  } | null;
  _count: {
    emails: number;
    reports: number;
  };
}

const meetingTypeLabels: Record<string, string> = {
  QBR: 'QBR',
  ANNUAL_REVIEW: 'Annual Review',
  WEEKLY_CHECKIN: 'Weekly Check-in',
  DEAL_REVIEW: 'Deal Review',
  OTHER: 'Meeting',
};

export default function MeetingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingBrief, setGeneratingBrief] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin');
    }
  }, [status]);

  const fetchMeetings = useCallback(async () => {
    try {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchMeetings();
    }
  }, [session, fetchMeetings]);

  const handleGenerateBrief = async (meetingId: string) => {
    setGeneratingBrief(meetingId);
    setMessage(null);

    try {
      const response = await fetch('/api/reports/meeting-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      });

      if (response.ok) {
        const report = await response.json();
        setMessage({ type: 'success', text: 'Meeting brief generated!' });
        router.push(`/reports/${report.id}`);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to generate brief' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate brief' });
    } finally {
      setGeneratingBrief(null);
    }
  };

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Meetings</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-md ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {meetings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No meetings detected yet.</p>
              <p className="mt-2 text-sm">
                Meetings are automatically created when you BCC emails with meeting-related subjects
                (QBR, Review, etc.).
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meeting
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emails
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {meetings.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{meeting.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {meeting.org?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {meetingTypeLabels[meeting.meetingType || ''] || meeting.meetingType || 'Meeting'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {meeting._count.emails}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(meeting.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleGenerateBrief(meeting.id)}
                        disabled={generatingBrief === meeting.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      >
                        {generatingBrief === meeting.id ? 'Generating...' : 'Generate Brief'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
