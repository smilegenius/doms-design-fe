import { useEffect } from 'react';

// Locks <body> scroll while the consumer is mounted so the modal stays
// centered against a frozen background. Restores the previous overflow
// on cleanup so multiple stacked modals leave the page in its prior state.
export function useLockBodyScroll(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
