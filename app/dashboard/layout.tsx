'use client';

import { ClientFilterProvider } from '@/lib/ClientFilterContext';
import { ClientDataProvider } from '@/lib/ClientDataContext';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientFilterProvider>
      <ClientDataProvider>
        {children}
      </ClientDataProvider>
    </ClientFilterProvider>
  );
}
