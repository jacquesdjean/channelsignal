export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-4 text-gray-600">
            A sign in link has been sent to your email address.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Click the link in the email to sign in. The link expires in 24 hours.
          </p>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            Don&apos;t see the email? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}
