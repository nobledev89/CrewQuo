'use client';

import { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface TrialBannerProps {
  subscriptionStatus: string;
  trialEndsAt?: Timestamp;
}

export default function TrialBanner({ subscriptionStatus, trialEndsAt }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (trialEndsAt && subscriptionStatus === 'trial') {
      let endDate: Date;
      if (trialEndsAt instanceof Timestamp) {
        endDate = trialEndsAt.toDate();
      } else if (typeof trialEndsAt === 'object' && 'seconds' in trialEndsAt) {
        // Handle Firestore Timestamp-like objects
        endDate = new Date((trialEndsAt as any).seconds * 1000);
      } else {
        endDate = new Date(trialEndsAt as any);
      }
      
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysLeft(diffDays);
    }
  }, [trialEndsAt, subscriptionStatus]);

  // Don't show banner if not on trial, dismissed, or no days left data
  if (subscriptionStatus !== 'trial' || dismissed || daysLeft === null) {
    return null;
  }

  // Determine banner color based on days left
  const getBannerColor = () => {
    if (daysLeft <= 1) return 'bg-gradient-to-r from-red-600 to-red-700';
    if (daysLeft <= 3) return 'bg-gradient-to-r from-orange-600 to-orange-700';
    return 'bg-gradient-to-r from-blue-600 to-indigo-600';
  };

  const getMessage = () => {
    if (daysLeft <= 0) return 'Your trial has expired';
    if (daysLeft === 1) return '1 day left in your free trial';
    return `${daysLeft} days left in your free trial`;
  };

  return (
    <div className={`${getBannerColor()} text-white py-3 px-4 shadow-lg relative`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{getMessage()}</p>
            <p className="text-sm opacity-90">
              Upgrade now to continue using CrewQuo without interruption
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href="/pricing"
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition text-sm whitespace-nowrap"
          >
            Upgrade Now
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded transition"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
