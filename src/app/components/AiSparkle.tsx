// Marks a value that was auto-extracted from a document (prescription PDF /
// email / scan) by AI, so the user knows it wasn't typed by hand and should be
// reviewed. Shown in light red, consistent across every field.
//   • default → just the twinkling sparkle
//   • label   → a small "✨ AI" pill (sparkle merged with an AI tag)
export function AiSparkle({
  title = 'Auto-filled from the prescription by AI — please review',
  className = '',
  label = false,
}: { title?: string; className?: string; label?: boolean }) {
  const sparkleSvg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-sparkles ai-twinkle ${label ? 'w-2.5 h-2.5' : 'w-3 h-3'}`}
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );

  if (label) {
    return (
      <span
        title={title}
        className={`inline-flex items-center gap-0.5 px-1 py-px rounded-full border border-[#FECACA] bg-[#FEF2F2] text-[#EF4444] align-middle flex-shrink-0 ${className}`}
        aria-label="Auto-filled by AI"
      >
        {sparkleSvg}
        <span className="text-[8px] font-bold tracking-wide leading-none text-[#DC2626]">AI</span>
      </span>
    );
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle text-[#EF4444] ${className}`}
      aria-label="Auto-filled by AI"
    >
      {sparkleSvg}
    </span>
  );
}
