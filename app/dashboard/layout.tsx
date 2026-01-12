'use client';

import { ClientFilterProvider } from '@/lib/ClientFilterContext';

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: ClientFilterProvider already wraps ClientDataProvider internally
  return (
    <ClientFilterProvider>
      {children}
    </ClientFilterProvider>
  );
}
