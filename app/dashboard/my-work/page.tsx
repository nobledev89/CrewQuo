'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyWorkPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to summary page by default
    router.replace('/dashboard/my-work/summary');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
