'use client';

import { SessionProvider } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Sidebar />
        <main className="md:pl-60 pb-16 md:pb-0 flex-1 flex flex-col">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex-1 w-full">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </SessionProvider>
  );
}
