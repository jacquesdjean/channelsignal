import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/options';
import { Navigation } from '@/components/Navigation';
import { CopyButton } from '@/components/CopyButton';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {/* BCC Address Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Your BCC Address
          </h2>
          <div className="flex items-center">
            <code className="flex-1 px-4 py-3 bg-gray-100 rounded font-mono text-sm">
              {session.user.bccAddress}
            </code>
            <CopyButton text={session.user.bccAddress} />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            BCC this address on your sales emails and calendar invites to automatically track conversations.
          </p>
        </div>

        {/* Instructions Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            How It Works
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-600">
            <li>
              <span className="font-medium">BCC your emails:</span> Add your unique BCC address to the BCC field when sending sales emails.
            </li>
            <li>
              <span className="font-medium">We extract signal:</span> ChannelSignal automatically extracts organizations, contacts, and deal context.
            </li>
            <li>
              <span className="font-medium">Get smarter reports:</span> Receive weekly pipeline summaries and pre-meeting briefs.
            </li>
          </ol>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/upload"
            className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">Upload Files</h3>
            <p className="mt-2 text-sm text-gray-600">
              Upload supporting documents, presentations, or notes.
            </p>
          </a>
          <a
            href="/reports"
            className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">View Reports</h3>
            <p className="mt-2 text-sm text-gray-600">
              Access your weekly summaries and meeting briefs.
            </p>
          </a>
        </div>
      </main>
    </div>
  );
}
