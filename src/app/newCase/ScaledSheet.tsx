import { ReactNode, useLayoutEffect, useRef, useState } from 'react';

/** The sheet at its print width, scaled down (never up) to the width it's given. */
export default function ScaledSheet({ children, sheetWidth = 760 }: { children: ReactNode; sheetWidth?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.5, h: 600 });
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / sheetWidth);
      setSize({ scale, h: i.scrollHeight * scale });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [sheetWidth]);
  return (
    <div ref={outer} className="relative overflow-hidden" style={{ height: size.h }}>
      <div ref={inner} className="absolute top-0 left-0 origin-top-left" style={{ width: sheetWidth, transform: `scale(${size.scale})` }}>
        {children}
      </div>
    </div>
  );
}
