import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SummaryStructured {
  executiveSummary?: string;
  keyMetrics?: { [k: string]: any };
  timeline?: Array<{ time?: string; event?: string }>;
  recommendations?: string[];
  uncertainties?: string[];
}

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  structured?: SummaryStructured | null;
  raw?: string | null;
  service?: string | null;
}

export function SummaryModal({ isOpen, onClose, loading, structured, raw, service }: SummaryModalProps) {
  const downloadSummary = React.useCallback(() => {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      if (structured) {
        const blob = new Blob([JSON.stringify(structured, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-summary-${ts}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else if (raw) {
        const blob = new Blob([raw], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-summary-${ts}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed', err);
    }
  }, [structured, raw]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[121] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-3xl w-full bg-gray-900/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-blue-500/30 shadow-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Session Summary</h3>
                  <p className="text-sm text-gray-400">AI-generated summary{service ? ` — ${service}` : ''}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={downloadSummary} disabled={!structured && !raw} className="px-2 py-1 bg-gray-800/40 text-gray-200 hover:bg-gray-800/60 rounded-md text-sm disabled:opacity-40" title="Download summary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4-4-4M21 21H3" />
                    </svg>
                  </button>
                  <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {loading && (
                  <div className="flex items-center gap-3 text-blue-400">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm">Generating summary...</span>
                  </div>
                )}

                {!loading && structured && (
                  <div className="max-h-[60vh] mt-2 space-y-4 summary-scrollbar">
                      <div className="overflow-auto rounded-xl p-2 max-h-[52vh]">
                    {structured.executiveSummary && (
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700">
                        <p className="text-sm text-gray-100 leading-relaxed">{structured.executiveSummary}</p>
                      </div>
                    )}

                    {structured.keyMetrics && (
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-2">Key Metrics</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-100">
                          {Object.entries(structured.keyMetrics).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-gray-300 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                              <span className="font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {structured.timeline && structured.timeline.length > 0 && (
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-2">Timeline</h4>
                        <ul className="text-sm text-gray-100 space-y-1">
                          {structured.timeline.map((item, idx) => (
                            <li key={idx}>
                              <span className="text-gray-300">{item.time || ''}</span>
                              <span className="ml-2">{item.event}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {structured.recommendations && structured.recommendations.length > 0 && (
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-2">Recommendations</h4>
                        <ul className="list-disc list-inside text-sm text-gray-100 space-y-1">
                          {structured.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {structured.uncertainties && structured.uncertainties.length > 0 && (
                      <div className="bg-gray-800/60 p-3 rounded-md border border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-2">Uncertainties / Notes</h4>
                        <ul className="text-sm text-gray-100 space-y-1">
                          {structured.uncertainties.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    </div>
                  </div>
                )}

                {!loading && !structured && raw && (
                  <div className="max-h-[60vh] mt-2 summary-scrollbar">
                    <div className="overflow-auto rounded-xl p-2 max-h-[52vh]">
                      <div className="bg-gray-800/70 p-4 rounded-md border border-gray-700">
                        <pre className="whitespace-pre-wrap text-sm text-gray-100 leading-relaxed font-sans">{raw}</pre>
                      </div>
                    </div>
                  </div>
                )}

                {!loading && !structured && !raw && (
                  <div className="text-sm text-gray-400 mt-2">No summary available.</div>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={onClose} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
