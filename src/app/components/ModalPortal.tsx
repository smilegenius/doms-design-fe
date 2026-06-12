import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Renders children at document.body so `fixed inset-0` modals cover the full
// viewport even when an ancestor (e.g. the page `.reveal` wrapper) uses
// `transform`, which would otherwise create a new containing block for
// fixed-positioned descendants and shrink the modal to that ancestor's box.
// Also locks body scroll while mounted so the page beneath stays still.
export default function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(children, document.body);
}
