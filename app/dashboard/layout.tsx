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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Render nothing during SSR and initial hydration to prevent mismatches
  if (!isClient) {
    return null;
  }

  return (
    <ClientFilterProvider>
      {children}
    </ClientFilterProvider>
  );
}
