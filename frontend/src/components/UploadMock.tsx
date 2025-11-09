import { useState } from 'react';

/**
 * Mock upload button component
 * Shows "Uploading session..." animation for 3 seconds when clicked
 */
export function UploadMock({ className = '' }: { className?: string }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
    }, 3000);
  };

  return (
    <div className={className}>
      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="w-full px-2 md:px-3 py-1.5 md:py-2.5 bg-blue-600/80 text-white rounded-lg hover:bg-blue-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-xs md:text-sm flex items-center justify-center gap-1"
      >
        {isUploading ? (
          <>
            <svg className="animate-spin h-3 w-3 md:h-4 md:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-[10px] md:text-xs">Uploading...</span>
          </>
        ) : (
          <span className="text-[10px] md:text-xs">📤 Upload</span>
        )}
      </button>
    </div>
  );
}

