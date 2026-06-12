interface CasesIconProps {
  className?: string;
}

/**
 * Cases icon — teeth framed by scanner corner brackets.
 *
 * Four L-shaped brackets in the corners (like a camera viewfinder or QR
 * scan reticle) frame a small tooth in the centre, suggesting "the scan
 * area capturing the patient's dentition". All shapes use `currentColor`
 * so the active gradient + hover states still apply uniformly.
 */
export default function CasesIcon({ className = "w-5 h-5" }: CasesIconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Scanner corner brackets — top-left, top-right, bottom-right, bottom-left */}
      <path
        d="M5 1.5H2.5C1.95 1.5 1.5 1.95 1.5 2.5V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15 1.5H17.5C18.05 1.5 18.5 1.95 18.5 2.5V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 15V17.5C18.5 18.05 18.05 18.5 17.5 18.5H15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 18.5H2.5C1.95 18.5 1.5 18.05 1.5 17.5V15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Tooth — molar shape with two cusps on the crown and two short roots,
          proportioned ~8 wide × 10 tall so it doesn't look stretched vertically. */}
      <path
        d="M5 7C5 5.7 6 5 7.2 5C8 5 8.5 5.3 8.7 5.7C8.85 5.95 9.15 5.95 9.3 5.7C9.5 5.3 10 5 10.8 5C12 5 13 5.7 13 7C13 8.5 12.7 10 12.2 11.5C12 12.3 11.8 13.5 11.5 14.3C11.3 14.85 10.4 14.85 10.2 14.3L9.6 12.4C9.5 12 8.5 12 8.4 12.4L7.8 14.3C7.6 14.85 6.7 14.85 6.5 14.3C6.2 13.5 6 12.3 5.8 11.5C5.3 10 5 8.5 5 7Z"
        fill="currentColor"
      />
    </svg>
  );
}
