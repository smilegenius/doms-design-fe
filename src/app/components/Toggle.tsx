// ── Toggle — the app's switch control ────────────────────────────────────────
// Extracted from SettingsPage so every preference surface uses the same
// switch. `disabled` renders the non-interactive greyed state (used when a
// channel isn't supported); pair it with `title` to explain why on hover.

interface ToggleProps {
  on: boolean;
  onChange?: () => void;
  disabled?: boolean;
  /** Hover tooltip — shown on the disabled state to explain the lock. */
  title?: string;
}

export default function Toggle({ on, onChange, disabled = false, title }: ToggleProps) {
  if (disabled) {
    return (
      <span
        title={title}
        role="switch"
        aria-checked={false}
        aria-disabled="true"
        className="relative w-11 h-6 rounded-full bg-[#EDEBF2] cursor-not-allowed inline-block flex-shrink-0"
      >
        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-[#F8F8FA] rounded-full shadow-sm" />
      </span>
    );
  }
  return (
    <button
      onClick={onChange}
      title={title}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        on ? 'bg-[#4D8EF7]' : 'bg-[#D4CEE1]'
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
