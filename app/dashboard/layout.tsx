'use client';

import { ClientFilterProvider } from '@/lib/ClientFilterContext';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientFilterProvider>
      {children}
    </ClientFilterProvider>
  );
}
