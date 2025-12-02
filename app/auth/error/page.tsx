'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'Access denied. You do not have permission to sign in.',
    Verification: 'The verification link has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  };

  const message = errorMessages[error || ''] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Authentication Error</h1>
          <p className="mt-4 text-gray-600">{message}</p>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
