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
            <div className="max-w-4xl w-full bg-gray-900/95 backdrop-blur-lg rounded-2xl p-6 md:p-8 border-2 border-blue-500/30 shadow-2xl overflow-hidden">
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
                  <div className="max-h-[70vh] mt-4 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                    {/* Executive Summary */}
                    {structured.executiveSummary && (
                      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-5 rounded-xl border border-blue-500/20 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h4 className="text-base font-bold text-white">Executive Summary</h4>
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">{structured.executiveSummary}</p>
                      </div>
                    )}

                    {/* Key Metrics */}
                    {structured.keyMetrics && (
                      <div className="bg-gray-800/40 p-5 rounded-xl border border-gray-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <h4 className="text-base font-bold text-white">Key Metrics</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(structured.keyMetrics).map(([k, v]) => {
                            const formattedKey = k.replace(/([A-Z])/g, ' $1').trim();
                            const formattedValue = typeof v === 'number' 
                              ? (k.toLowerCase().includes('bpm') || k.toLowerCase().includes('rate') 
                                  ? `${Math.round(v)} BPM`
                                  : k.toLowerCase().includes('depth') || k.toLowerCase().includes('mm')
                                  ? `${v} mm`
                                  : k.toLowerCase().includes('sec') || k.toLowerCase().includes('time')
                                  ? `${v}s`
                                  : k.toLowerCase().includes('total')
                                  ? v.toLocaleString()
                                  : v)
                              : String(v);
                            
                            return (
                              <div key={k} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/30">
                                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{formattedKey}</div>
                                <div className="text-lg font-bold text-white">{formattedValue}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {structured.timeline && structured.timeline.length > 0 && (
                      <div className="bg-gray-800/40 p-5 rounded-xl border border-gray-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h4 className="text-base font-bold text-white">Session Timeline</h4>
                        </div>
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700/50"></div>
                          <div className="space-y-4">
                            {structured.timeline.map((item, idx) => (
                              <div key={idx} className="relative flex items-start gap-4 pl-2">
                                {/* Timeline dot */}
                                <div className="relative z-10 mt-1.5">
                                  <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-gray-900"></div>
                                </div>
                                <div className="flex-1 pb-4">
                                  <div className="text-xs font-semibold text-yellow-400 mb-1">{item.time || `${idx * 10}s`}</div>
                                  <div className="text-sm text-gray-200 leading-relaxed">{item.event}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {structured.recommendations && structured.recommendations.length > 0 && (
                      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-5 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h4 className="text-base font-bold text-white">Recommendations</h4>
                        </div>
                        <ul className="space-y-3">
                          {structured.recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></div>
                              <span className="text-sm text-gray-200 leading-relaxed">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Uncertainties / Notes */}
                    {structured.uncertainties && structured.uncertainties.length > 0 && (
                      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5 rounded-xl border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <h4 className="text-base font-bold text-white">Notes & Uncertainties</h4>
                        </div>
                        <ul className="space-y-2">
                          {structured.uncertainties.map((u, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></div>
                              <span className="text-sm text-gray-200 leading-relaxed">{u}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
