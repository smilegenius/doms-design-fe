interface OverviewIconProps {
  className?: string;
}

export default function OverviewIcon({ className = "w-5 h-5" }: OverviewIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="0.5" y="0.5" width="8" height="8" rx="1.5" fill="currentColor"/>
      <rect x="11.5" y="0.5" width="8" height="8" rx="1.5" fill="currentColor"/>
      <rect x="0.5" y="11.5" width="8" height="8" rx="1.5" fill="currentColor"/>
      <rect x="11.5" y="11.5" width="8" height="8" rx="1.5" fill="currentColor"/>
    </svg>
  );
}
