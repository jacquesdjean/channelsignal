import Link from 'next/link';

const footerLinks = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/channels', label: 'Channels' },
  { href: '/uploads', label: 'Upload Files' },
  { href: '/settings', label: 'Settings' },
];

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          {/* Logo and tagline */}
          <div className="mb-6 md:mb-0">
            <span className="text-xl font-bold text-white">ChannelSignal</span>
            <p className="mt-1 text-sm">
              Email-native sales intelligence for multi-org channel reps
            </p>
          </div>

          {/* Navigation links */}
          <nav className="flex flex-wrap gap-x-8 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-sm text-center md:text-left">
            &copy; {new Date().getFullYear()} ChannelSignal. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
