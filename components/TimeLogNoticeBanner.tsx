'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type BannerRole = 'subcontractor' | 'admin_manager' | 'client' | null;

interface TimeLogNoticeBannerProps {
  role: BannerRole;
}

const STORAGE_PREFIX = 'cq_notice_march_time_logs_v1';

const messages: Record<Exclude<BannerRole, null>, string> = {
  subcontractor:
    'March time logs: We found a short-lived bug that affected some March entries. Your hours and pay totals are correct, but the exact time-in/time-out details for those entries may not be available. This is now fixed for all new logs. We are strengthening our security and verification controls so this does not happen again - your data is safe.',
  admin_manager:
    'March time logs: A brief logging bug affected some March entries. Total hours and costs are accurate, but the specific time-in/time-out details for those entries may be missing. The issue is resolved for new logs. We are strengthening our security and verification controls so this does not happen again - your data is safe.',
  client:
    'March time logs: A short-term logging issue affected some March entries. Hour totals and billing are correct, but the exact time-in/time-out details for those entries may not appear. This has been fixed going forward. We are strengthening our security and verification controls so this does not happen again - your data is safe.',
};

export default function TimeLogNoticeBanner({ role }: TimeLogNoticeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!role) return;
    const key = `${STORAGE_PREFIX}:${role}`;
    const stored = localStorage.getItem(key);
    if (stored === '1') {
      setDismissed(true);
    }
  }, [role]);

  if (!role || dismissed) {
    return null;
  }

  const message = messages[role];

  const handleClose = () => {
    if (role && dontShowAgain) {
      const key = `${STORAGE_PREFIX}:${role}`;
      localStorage.setItem(key, '1');
    }
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold">March time log notice</p>
          <p className="text-sm text-amber-800">{message}</p>
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-amber-800">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don&apos;t show again
          </label>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-amber-100 transition"
          aria-label="Dismiss notice"
        >
          <X className="w-5 h-5 text-amber-700" />
        </button>
      </div>
    </div>
  );
}

