/**
 * Mode Selection Screen
 * Allows user to choose between Bystander Mode and EMT Mode
 */

interface ModeSelectionProps {
  onSelectMode: (mode: 'walkthrough' | 'feedback') => void;
}

export function ModeSelection({ onSelectMode }: ModeSelectionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-red-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          {/* Logo Image */}
          <div className="flex justify-center mb-4">
            <img 
              src="/pulseai-logo.png" 
              alt="PulseAI" 
              className="h-32 md:h-40 w-auto object-contain"
            />
          </div>
          <p className="text-xl text-[#7b0000] font-semibold mb-2">CPR Training Assistant</p>
          <p className="text-sm text-[#ff524a] mt-4 font-semibold">
            Training app—call 911 in real emergencies
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Walkthrough Mode */}
          <button
            onClick={() => onSelectMode('walkthrough')}
            className="bg-white rounded-2xl p-8 border-2 border-[#ff524a] hover:border-[#7b0000] hover:bg-red-50 transition-all duration-300 transform hover:scale-105 group shadow-lg"
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-[#ff524a]/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-[#ff524a]/30 transition-colors">
                <svg
                  className="w-10 h-10 text-[#7b0000]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#7b0000] mb-3">Bystander Mode</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                Learn CPR basics with step-by-step guidance. Ideal for first-time responders who need
                clear instructions during an emergency.
              </p>
            </div>
          </button>

          {/* Feedback Mode */}
          <button
            onClick={() => onSelectMode('feedback')}
            className="bg-white rounded-2xl p-8 border-2 border-[#ff524a] hover:border-[#7b0000] hover:bg-red-50 transition-all duration-300 transform hover:scale-105 group shadow-lg"
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-[#ff524a]/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-[#ff524a]/30 transition-colors">
                <svg
                  className="w-10 h-10 text-[#7b0000]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#7b0000] mb-3">EMT Mode</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                Advanced real-time CPR analysis with detailed metrics. Designed for trained professionals
                to refine technique and maintain certification standards.
              </p>
            </div>
          </button>
        </div>

        <div className="mt-8 text-center text-[#7b0000] text-sm">
          <p>Allow camera access when prompted to begin training</p>
        </div>
      </div>
    </div>
  );
}

