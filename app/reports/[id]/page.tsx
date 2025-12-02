'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import Link from 'next/link';

interface Report {
  id: string;
  type: string;
  htmlContent: string | null;
  content: object;
  generatedAt: string;
}

export default function ReportViewPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin');
    }
  }, [status]);

  useEffect(() => {
    async function fetchReport() {
      if (!session || !params.id) return;

      try {
        const response = await fetch(`/api/reports/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setReport(data);
        } else if (response.status === 404) {
          setError('Report not found');
        } else {
          setError('Failed to load report');
        }
      } catch (err) {
        setError('Failed to load report');
      } finally {
        setIsLoading(false);
      }
    }

    if (session) {
      fetchReport();
    }
  }, [session, params.id]);

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500">{error}</p>
            <Link href="/reports" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
              Back to Reports
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/reports" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Reports
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {report?.htmlContent ? (
            <div
              dangerouslySetInnerHTML={{ __html: report.htmlContent }}
              className="p-0"
            />
          ) : (
            <div className="p-8">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(report?.content, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
