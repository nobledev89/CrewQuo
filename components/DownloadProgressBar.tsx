/**
 * Download Progress Bar Component
 * Shows loading indicator during file export operations
 */

import { Download } from 'lucide-react';

interface DownloadProgressBarProps {
  format: 'CSV' | 'XLSX' | 'PDF' | null;
  isVisible: boolean;
}

export default function DownloadProgressBar({ format, isVisible }: DownloadProgressBarProps) {
  if (!isVisible || !format) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Animated icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <Download className="w-16 h-16 text-blue-600 animate-bounce" />
              <div className="absolute -inset-2 bg-blue-200 rounded-full animate-ping opacity-25"></div>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Preparing Your Download
          </h3>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            Generating {format} file...
          </p>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full animate-progress"></div>
          </div>

          {/* Sub-message */}
          <p className="text-sm text-gray-500 mt-4">
            This should only take a moment
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
