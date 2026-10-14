import { ReactNode, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImageOff, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import type { DesignFile } from '../data/designStudio';
import { useFileUrl } from '../store/fileStore';

// Uploaded-image designs (renders / screenshots from the CAD software): the
// canvas becomes an image stage with a page strip. Capture freezes the
// current image so it can be marked up like a 3D capture.

function Thumb({ file, on, onClick }: { file: DesignFile; on: boolean; onClick: () => void }) {
  const url = useFileUrl(file.id);
  return (
    <button onClick={onClick} className={`w-12 h-9 rounded-md overflow-hidden border-2 flex-shrink-0 ${on ? 'border-[#4D8EF7]' : 'border-transparent opacity-70 hover:opacity-100'}`} title={file.name}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="block w-full h-full bg-[#F0EFF6]" />}
    </button>
  );
}

export default function ImageStage({ images, index, onIndex, onCapture, label, className = '' }: {
  images: DesignFile[];
  index: number;
  onIndex: (i: number) => void;
  onCapture?: () => void;
  label?: ReactNode;
  className?: string;
}) {
  const file = images[Math.min(index, images.length - 1)];
  const url = useFileUrl(file?.id);
  const [zoom, setZoom] = useState(1);
  return (
    <div className={`relative bg-[#F0F2F7] rounded-xl border border-[#E0E0E6] overflow-hidden ${className}`}>
      <div className="absolute inset-0 overflow-auto flex items-center justify-center p-10">
        {url === null ? (
          <div className="text-center text-[#717182]">
            <ImageOff className="w-6 h-6 mx-auto mb-1" />
            <p className="text-xs">This file isn't available on this device.</p>
          </div>
        ) : url ? (
          <img src={url} alt={file.name} className="max-w-full max-h-full object-contain rounded-md shadow-sm select-none transition-transform" style={{ transform: `scale(${zoom})` }} draggable={false} />
        ) : null}
      </div>
      <div className="absolute top-3 left-3 inline-flex items-center bg-white border border-[#E0E0E6] rounded-lg overflow-hidden text-[11px] font-semibold px-2.5 py-1 text-[#4D8EF7]">
        Image {index + 1} of {images.length}
      </div>
      {label && <div className="absolute top-12 left-3 sm:top-3 sm:left-1/2 sm:-translate-x-1/2">{label}</div>}
      <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-[#1B1B2D] rounded-lg p-1.5">
        <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.5))} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button onClick={() => setZoom(1)} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80" title="Fit"><Maximize className="w-3.5 h-3.5" /></button>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
        <div className="inline-flex items-center gap-1 bg-[#1B1B2D] rounded-full px-1.5 py-1.5 max-w-full overflow-x-auto">
          <button onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-40 flex-shrink-0" aria-label="Previous image"><ChevronLeft className="w-3.5 h-3.5 text-white" /></button>
          {images.length > 1 && images.map((f, i) => <Thumb key={f.id} file={f} on={i === index} onClick={() => onIndex(i)} />)}
          <button onClick={() => onIndex(Math.min(images.length - 1, index + 1))} disabled={index === images.length - 1} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-40 flex-shrink-0" aria-label="Next image"><ChevronRight className="w-3.5 h-3.5 text-white" /></button>
        </div>
        {onCapture && (
          <button onClick={onCapture} className="inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] shadow-lg hover:opacity-90 flex-shrink-0">
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Capture this image</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/25 text-[10px] font-bold">C</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
