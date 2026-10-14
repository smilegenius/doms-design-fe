import { useEffect, useState } from 'react';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { markPhotoSeen, sampleForCase, useRxInbox } from '../inboxStore';
import PrescriptionPhotoViewer from './PrescriptionPhotoViewer';

/**
 * Sits over the (unchanged) QuickCreate draft screen for inbox drafts: a
 * compact pill with the photo's first page that opens the page viewer. The
 * viewer opens by itself the first time a draft is reviewed.
 */
export default function RxPhotoDock({ caseId }: { caseId: string }) {
  const { inbound, photoSeen } = useRxInbox();
  const sample = sampleForCase(caseId);
  const from = inbound.find(m => m.id === caseId)?.from;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sample && !photoSeen.includes(caseId)) {
      setOpen(true);
      markPhotoSeen(caseId);
    }
    // Only on first mount for this draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  if (!sample) return null;
  const n = sample.pages.length;

  return (
    <>
      <div className="fixed left-4 bottom-20 z-[60] rounded-xl border border-[#DBEAFE] bg-[#EEF4FF] shadow-lg pl-1.5 pr-3 py-1.5">
        <div className="flex items-center gap-2.5">
          <button onClick={() => setOpen(true)} className="relative flex-shrink-0" aria-label="View prescription photo">
            <img src={sample.pages[0]} alt="" className="w-10 h-[52px] object-cover rounded-md border border-white" />
            {n > 1 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#4D8EF7] text-white text-[9px] font-bold flex items-center justify-center">{n}</span>
            )}
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#1565C0] flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Prescription photo
            </p>
            <p className="text-[10px] text-[#3B6BAE]">{sample.photoName} · {n} page{n === 1 ? '' : 's'}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
          >
            View <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <PrescriptionPhotoViewer open={open} onClose={() => setOpen(false)} sample={sample} from={from} />
    </>
  );
}
