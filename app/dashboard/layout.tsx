'use client';

import { ClientFilterProvider } from '@/lib/ClientFilterContext';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  // Only render on client to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show nothing during SSR, only render on client
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ClientFilterProvider>
      {children}
    </ClientFilterProvider>
  );
}
