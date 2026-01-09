'use client';

import { ClientFilterProvider } from '@/lib/ClientFilterContext';
import { ClientDataProvider } from '@/lib/ClientDataContext';
import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Always render the providers, but show loading state during hydration
  return (
    <ClientDataProvider>
      <ClientFilterProvider>
        {!isClient ? (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mb-4 mx-auto">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-600 font-medium">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          children
        )}
      </ClientFilterProvider>
    </ClientDataProvider>
  );
}
