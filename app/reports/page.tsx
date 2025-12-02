'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { format } from 'date-fns';
import Link from 'next/link';

interface ReportListItem {
  id: string;
  type: 'WEEKLY' | 'MEETING_BRIEF' | 'QUARTERLY' | 'ANNUAL';
  periodStart: string | null;
  periodEnd: string | null;
  meetingId: string | null;
  generatedAt: string;
  meeting?: {
    title: string;
  } | null;
}

const reportTypeLabels: Record<string, string> = {
  WEEKLY: 'Weekly Summary',
  MEETING_BRIEF: 'Meeting Brief',
  QUARTERLY: 'Quarterly Report',
  ANNUAL: 'Annual Report',
};

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin');
    }
  }, [status]);

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchReports();
    }
  }, [session, fetchReports]);

  const handleGenerateWeekly = async () => {
    setIsGenerating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Weekly report generated!' });
        fetchReports();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to generate report' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate report' });
    } finally {
      setIsGenerating(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <button
            onClick={handleGenerateWeekly}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Weekly Report'}
          </button>
        </div>

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
          {reports.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No reports generated yet.</p>
              <p className="mt-2 text-sm">
                Click "Generate Weekly Report" to create your first report.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period / Meeting
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Generated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {reportTypeLabels[report.type] || report.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.type === 'MEETING_BRIEF' ? (
                        report.meeting?.title || 'Meeting'
                      ) : report.periodStart && report.periodEnd ? (
                        `${format(new Date(report.periodStart), 'MMM d')} - ${format(new Date(report.periodEnd), 'MMM d, yyyy')}`
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(report.generatedAt), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/reports/${report.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
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
