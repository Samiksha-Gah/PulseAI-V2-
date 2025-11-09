import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config';

interface SampleEntry {
  time: number;
  iso: string;
  metrics: any | null;
}

export function SessionReport({ session, onClose } : { session: { generatedAt: string; samples: SampleEntry[] }, onClose: () => void }) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const doReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const prompt = `You are an expert CPR analytics assistant. Given the following JSON session data (samples of per-second CPR metrics), produce a comprehensive, well-structured report. Include: an executive summary, key metrics and averages (rate/BPM, depth), notable trends, detected anomalies or concerning periods, actionable recommendations for improvement, and timestamped references where appropriate. Present the report in clear sections and keep it professional.
\nSession JSON:\n${JSON.stringify(session, null, 2)}`;

        const resp = await fetch(API_ENDPOINTS.query, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: prompt,
            context: 'Full session export for automated reporting',
            returnText: true
          }),
        });

        const contentType = resp.headers.get('content-type') || '';
        if (!resp.ok) {
          // Try to parse JSON error
          if (contentType.includes('application/json')) {
            const err = await resp.json().catch(() => null);
            setError(err?.error || err?.message || `Server error: ${resp.status}`);
          } else {
            const txt = await resp.text().catch(() => '<no body>');
            setError(`Server error: ${resp.status} - ${txt}`);
          }
          setLoading(false);
          return;
        }

        // Response should be JSON with answer field (because we requested returnText)
        const data = await resp.json().catch(() => null);
        if (!data) {
          setError('Empty response from server');
          setLoading(false);
          return;
        }

        if (data.answer) {
          setReport(data.answer);
        } else if (typeof data === 'string') {
          setReport(data);
        } else {
          setReport(JSON.stringify(data, null, 2));
        }

      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    doReport();
  }, [session]);

  const handleDownload = () => {
    const content = {
      session,
      report,
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-6 space-y-4">
      <div className="w-full max-w-3xl bg-gray-900/90 rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Session Report</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="px-3 py-1 bg-blue-600 rounded text-white text-sm">Download JSON</button>
            <button onClick={onClose} className="px-3 py-1 bg-gray-700 rounded text-white text-sm">Close</button>
          </div>
        </div>

        {loading && (
          <div className="py-8 text-center text-gray-300">Generating report... this may take a few seconds.</div>
        )}

        {error && (
          <div className="p-4 bg-red-600/20 text-red-300 rounded">Error: {error}</div>
        )}

        {report && (
          <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-gray-100">
            {report}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionReport;
