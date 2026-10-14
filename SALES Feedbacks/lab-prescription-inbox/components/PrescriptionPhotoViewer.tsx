import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import SideDrawer from '../../../src/app/components/SideDrawer';
import type { SamplePrescription } from '../data';

const ZOOMS = [1, 1.5, 2, 3];

/**
 * The photographed paper prescription, page by page, in the portal's side
 * drawer. Zoom, rotate, a page strip and ←/→ keys.
 */
export default function PrescriptionPhotoViewer({ open, onClose, sample, from, initialPage = 0 }: {
  open: boolean;
  onClose: () => void;
  sample: SamplePrescription;
  from?: string;
  initialPage?: number;
}) {
  const pages = sample.pages;
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(0);
  const [rotation, setRotation] = useState(0);

  // Each page opens fitted and upright.
  useEffect(() => { setZoom(0); setRotation(0); }, [page]);
  useEffect(() => { if (open) setPage(initialPage); }, [open, initialPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPage(p => Math.min(pages.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setPage(p => Math.max(0, p - 1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pages.length, onClose]);

  const scale = ZOOMS[zoom];
  const iconBtn = 'w-8 h-8 rounded-lg border border-[#E0E0E6] bg-white text-[#5A5568] hover:bg-[#F8F9FC] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors';

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Prescription photo"
      subtitle={`${sample.photoName} · ${pages.length} page${pages.length === 1 ? '' : 's'}${from ? ` · from ${from}` : ''}`}
      icon={<ImageIcon className="w-4 h-4 text-[#4D8EF7]" />}
      zIndex="z-[120]"
    >
      {/* Fill the drawer body edge to edge (it pads its children by 1rem). */}
      <div className="-m-4 flex flex-col h-[calc(100%+2rem)] min-h-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#F0EFF6] bg-[#F8F9FC] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button className={iconBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-[#030213] tabular-nums min-w-[84px] text-center">
              Page {page + 1} of {pages.length}
            </span>
            <button className={iconBtn} disabled={page === pages.length - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className={iconBtn} disabled={zoom === 0} onClick={() => setZoom(z => z - 1)} aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-[#717182] tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
            <button className={iconBtn} disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(z => z + 1)} aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            <button className={iconBtn} onClick={() => { setZoom(0); setRotation(0); }} aria-label="Fit to width"><Maximize2 className="w-3.5 h-3.5" /></button>
            <button className={iconBtn} onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate"><RotateCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Photo */}
        <div className="flex-1 min-h-0 overflow-auto bg-[#2B2A33]">
          <div className="p-4 flex justify-center" style={{ minWidth: `${scale * 100}%` }}>
            <img
              src={pages[page]}
              alt={`${sample.photoName}, page ${page + 1} of ${pages.length}`}
              className="rounded-md shadow-lg transition-transform duration-200 select-none"
              style={{ width: `${scale * 100}%`, maxWidth: 'none', transform: `rotate(${rotation}deg)` }}
              draggable={false}
            />
          </div>
        </div>

        {/* Page strip */}
        {pages.length > 1 && (
          <div className="flex items-center gap-3 px-4 py-3 border-t border-[#F0EFF6] flex-shrink-0 overflow-x-auto">
            {pages.map((src, i) => (
              <button
                key={src}
                onClick={() => setPage(i)}
                className={`flex-shrink-0 rounded-lg border-2 p-0.5 transition-colors ${i === page ? 'border-[#4D8EF7]' : 'border-transparent hover:border-[#DBEAFE]'}`}
                aria-label={`Page ${i + 1}`}
              >
                <img src={src} alt="" className="w-14 h-[74px] object-cover rounded-md" />
                <span className={`block text-[10px] mt-0.5 ${i === page ? 'text-[#1565C0] font-semibold' : 'text-[#717182]'}`}>Page {i + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </SideDrawer>
  );
}
