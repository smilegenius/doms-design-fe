import { useRef, useState } from 'react';
import { Box, FileArchive, FileText, FolderOpen, ImageIcon, Layers, Paperclip, Upload, X } from 'lucide-react';
import SideDrawer from '../../../src/app/components/SideDrawer';
import { useToast } from '../../../src/app/context/ToastContext';
import { ACCEPTED_FILES, DesignFile, formatBytes } from '../data/designStudio';
import { downloadFile, FileCheck, openFileInTab, storeFiles, useFileUrl } from '../store/fileStore';
import DesignViewer, { useCamera } from '../viewer/DesignViewer';
import { useMeshScene } from '../viewer/meshLoaders';

// Shared file UI: drop zone, chips, and the open handlers (image lightbox,
// mesh preview drawer, PDF in a new tab). Used by the lab's upload share,
// the dentist's attachments, and the lab's view of those attachments.

/** Validate + store dropped/picked files; reports rejections as toasts. */
type Storer = (files: File[], uploadedBy: DesignFile['uploadedBy']) => Promise<FileCheck>;

export function useFileIntake(uploadedBy: DesignFile['uploadedBy'], onAdded: (files: DesignFile[]) => void, store: Storer = storeFiles) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async add(list: FileList | File[] | null) {
      const files = [...(list ?? [])];
      if (!files.length) return;
      setBusy(true);
      const { ok, rejected } = await store(files, uploadedBy);
      setBusy(false);
      rejected.forEach(r => toast.error(r));
      if (ok.length) onAdded(ok);
    },
  };
}

export function FileDropZone({ uploadedBy, onAdded, title = 'Drop files here or browse', hint = 'STL, OBJ, PLY, images or PDF · up to 50MB each', compact = false, store, accept = ACCEPTED_FILES, folder = false }: {
  uploadedBy: DesignFile['uploadedBy'];
  onAdded: (files: DesignFile[]) => void;
  title?: string;
  hint?: string;
  compact?: boolean;
  /** Custom validation + storage (upload links take DICOM and ZIPs too). */
  store?: Storer;
  /** File-picker filter; '' accepts anything (extensionless DICOM). */
  accept?: string;
  /** Offer "Choose a folder" — DICOM exports are folders. */
  folder?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dir = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const intake = useFileIntake(uploadedBy, onAdded, store);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); intake.add(e.dataTransfer.files); }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
      className={`rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${compact ? 'px-3 py-3' : 'px-4 py-6'} ${over ? 'border-[#4D8EF7] bg-[#E3F2FD]' : 'border-[#E0E0E6] bg-[#F8F9FC] hover:border-[#4D8EF7]'}`}
    >
      <input ref={input} type="file" multiple accept={accept || undefined} className="hidden" onChange={e => { intake.add(e.target.files); e.target.value = ''; }} />
      {folder && (
        <input
          ref={el => { dir.current = el; el?.setAttribute('webkitdirectory', ''); }}
          type="file" multiple className="hidden"
          onChange={e => { intake.add(e.target.files); e.target.value = ''; }}
        />
      )}
      <Upload className={`mx-auto text-[#4D8EF7] ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} />
      <p className={`font-semibold text-[#030213] mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>{intake.busy ? 'Saving files…' : title}</p>
      <p className="text-[11px] text-[#717182]">{hint}</p>
      {folder && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); dir.current?.click(); }}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC]"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#4D8EF7]" /> Choose a folder
        </button>
      )}
    </div>
  );
}

/** Small paperclip button that adds files (per-capture attachments). */
export function AttachButton({ uploadedBy, onAdded }: { uploadedBy: DesignFile['uploadedBy']; onAdded: (files: DesignFile[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const intake = useFileIntake(uploadedBy, onAdded);
  return (
    <>
      <input ref={input} type="file" multiple accept={ACCEPTED_FILES} className="hidden" onChange={e => { intake.add(e.target.files); e.target.value = ''; }} />
      <button
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-[#E0E0E6] text-[#717182] hover:border-[#4D8EF7] hover:text-[#4D8EF7]"
      >
        <Paperclip className="w-3 h-3" /> {intake.busy ? 'Saving…' : 'Attach'}
      </button>
    </>
  );
}

function ChipIcon({ file }: { file: DesignFile }) {
  const url = useFileUrl(file.kind === 'image' ? file.id : undefined);
  if (file.kind === 'image') {
    return url ? <img src={url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" /> : <span className="w-7 h-7 rounded bg-[#F0EFF6] flex-shrink-0" />;
  }
  const Icon = file.kind === 'mesh' ? Box : file.kind === 'dicom' ? Layers : file.kind === 'archive' ? FileArchive : FileText;
  return <span className="w-7 h-7 rounded bg-[#E3F2FD] flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-[#1565C0]" /></span>;
}

function LightboxImage({ file }: { file: DesignFile }) {
  const url = useFileUrl(file.id);
  if (url === null) return <p className="text-xs text-[#717182] text-center py-10">This file isn't available on this device.</p>;
  return url ? <img src={url} alt={file.name} className="w-full rounded-lg" /> : null;
}

// The viewer needs a model even when it renders an uploaded mesh instead.
const PREVIEW_MODEL = { kind: 'smile-design' as const, shade: 'A2' };

function MeshPreview({ file }: { file: DesignFile }) {
  const scene = useMeshScene([file]);
  const { camera, setCamera, flyTo } = useCamera();
  if (scene === undefined) return <p className="text-xs text-[#717182] text-center py-10">Loading {file.name}…</p>;
  if (!scene) return <p className="text-xs text-[#717182] text-center py-10">We couldn't read {file.name}.</p>;
  return <DesignViewer model={PREVIEW_MODEL} kind="smile-design" scene={scene} camera={camera} onCameraChange={setCamera} onFlyTo={flyTo} compactPill className="h-[60vh]" />;
}

export function kindLabel(f: DesignFile) {
  if (f.kind === 'dicom') return `DICOM · ${f.parts?.length ?? 1} file${f.parts?.length === 1 ? '' : 's'}`;
  return f.kind === 'mesh' ? '3D' : f.kind === 'pdf' ? 'PDF' : f.kind === 'archive' ? 'ZIP' : 'Image';
}

/** Chips for a set of files; images open a lightbox, meshes a 3D preview, PDFs a new tab, DICOM / ZIP download. */
export function FileList({ files, onRemove, title }: { files: DesignFile[]; onRemove?: (id: string) => void; title?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState<DesignFile | null>(null);
  const images = files.filter(f => f.kind === 'image');
  if (!files.length) return null;

  function openFile(f: DesignFile) {
    if (f.kind === 'dicom' || f.kind === 'archive') {
      downloadFile(f).then(n => { if (n) toast.success(`Downloading ${f.name}${f.parts ? ` (${n} files)` : ''}`); else toast.error(`${f.name} isn't available on this device`); });
    } else if (f.kind === 'pdf') openFileInTab(f.id).then(ok => { if (!ok) toast.error(`${f.name} isn't available on this device`); });
    else setOpen(f);
  }

  return (
    <div>
      {title && <p className="text-[11px] font-semibold text-[#717182] uppercase tracking-wide mb-1.5">{title}</p>}
      <div className="flex flex-wrap gap-1.5">
        {files.map(f => (
          <div key={f.id} className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg border border-[#E0E0E6] bg-white max-w-[260px]">
            <button onClick={() => openFile(f)} className="inline-flex items-center gap-2 min-w-0 text-left" title={`Open ${f.name}`}>
              <ChipIcon file={f} />
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-[#030213] truncate">{f.name}</span>
                <span className="block text-[10px] text-[#A0A0B0]">{kindLabel(f)} · {formatBytes(f.size)}{f.uploadedBy === 'clinician' ? ' · from dentist' : ''}</span>
              </span>
            </button>
            {onRemove && (
              <button onClick={() => onRemove(f.id)} className="text-[#A0A0B0] hover:text-[#D4183D] flex-shrink-0" aria-label={`Remove ${f.name}`}><X className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>
      {open && (
        <SideDrawer
          open
          onClose={() => setOpen(null)}
          title={open.name}
          subtitle={`${open.kind === 'mesh' ? '3D file' : 'Image'} · ${formatBytes(open.size)}${open.uploadedBy === 'clinician' ? ' · from the dentist' : ''}`}
          icon={open.kind === 'mesh' ? <Box className="w-4 h-4 text-[#4D8EF7]" /> : <ImageIcon className="w-4 h-4 text-[#4D8EF7]" />}
          zIndex="z-[120]"
        >
          {open.kind === 'mesh' ? <MeshPreview file={open} /> : (
            <div className="space-y-3">
              <LightboxImage file={open} />
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map(img => (
                    <button key={img.id} onClick={() => setOpen(img)} className={`rounded-lg border-2 p-0.5 flex-shrink-0 ${img.id === open.id ? 'border-[#4D8EF7]' : 'border-transparent'}`}>
                      <ChipIcon file={img} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SideDrawer>
      )}
    </div>
  );
}
