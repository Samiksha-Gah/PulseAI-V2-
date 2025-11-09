/**
 * Control Buttons Component
 * Small, unobtrusive circular icon buttons for civilian mode
 */

interface ControlButtonsProps {
  metronomeEnabled: boolean;
  onMetronomeToggle: () => void;
  onSave: () => void;
  onQuery: () => void;
  onCameraFlip: () => void;
}

export function ControlButtons({
  metronomeEnabled,
  onMetronomeToggle,
  onSave,
  onQuery,
  onCameraFlip,
}: ControlButtonsProps) {
  const buttonClass = "w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 border border-white/40 hover:border-white/60 flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-lg active:scale-95";

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2.5">
      {/* Metronome Toggle */}
      <button
        onClick={onMetronomeToggle}
        className={buttonClass}
        title={metronomeEnabled ? "Metronome: ON" : "Metronome: OFF"}
      >
        {metronomeEnabled ? (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
      </button>

      {/* Save Button */}
      <button
        onClick={onSave}
        className={buttonClass}
        title="Save"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      </button>

      {/* Query Button */}
      <button
        onClick={onQuery}
        className={buttonClass}
        title="Query"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Camera Flip Button */}
      <button
        onClick={onCameraFlip}
        className={buttonClass}
        title="Flip Camera"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}

