import { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import type { DesignFile, DesignVersion } from '../data/designStudio';
import DesignViewer from './DesignViewer';
import ImageStage from './ImageStage';
import { useMeshScene } from './meshLoaders';
import type { Scene } from './archModel';

// Picks the right stage for a version: an uploaded mesh (STL / OBJ / PLY),
// uploaded images, or the procedural preview of a linked design.

export type StageMode = 'mesh' | 'images' | 'procedural' | 'loading';

export function useVersionStage(version?: DesignVersion): { mode: StageMode; scene: Scene | null | undefined; images: DesignFile[] } {
  const files = version?.files ?? [];
  const scene = useMeshScene(files);
  const images = files.filter(f => f.kind === 'image');
  const hasMesh = files.some(f => f.kind === 'mesh');
  const mode: StageMode = hasMesh && scene === undefined ? 'loading' : hasMesh && scene ? 'mesh' : images.length ? 'images' : 'procedural';
  return { mode, scene, images };
}

type ViewerProps = Omit<ComponentProps<typeof DesignViewer>, 'model' | 'kind' | 'scene'>;

export default function VersionViewer({ version, imageIndex, onImageIndex, showImages = false, onShowImages, ...props }: ViewerProps & {
  version: DesignVersion;
  imageIndex: number;
  onImageIndex: (i: number) => void;
  /** Versions with both a mesh and images: which one is on stage. */
  showImages?: boolean;
  onShowImages?: (on: boolean) => void;
}) {
  const { mode, scene, images } = useVersionStage(version);
  if (mode === 'loading') {
    return (
      <div className={`relative bg-[#F0F2F7] rounded-xl border border-[#E0E0E6] flex items-center justify-center ${props.className ?? ''}`}>
        <span className="inline-flex items-center gap-2 text-xs text-[#717182]"><Loader2 className="w-4 h-4 animate-spin" /> Loading the design files…</span>
      </div>
    );
  }
  const both = mode === 'mesh' && images.length > 0 && !!onShowImages;
  const switcher = both && (
    <div className="absolute z-10 bottom-16 left-3 inline-flex p-0.5 bg-white border border-[#E0E0E6] rounded-lg shadow-sm">
      {([[false, '3D model'], [true, `Images (${images.length})`]] as const).map(([on, label]) => (
        <button key={label} onClick={() => onShowImages!(on)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${showImages === on ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white' : 'text-[#717182]'}`}>
          {label}
        </button>
      ))}
    </div>
  );
  const stage = mode === 'images' || (both && showImages)
    ? <ImageStage images={images} index={imageIndex} onIndex={onImageIndex} onCapture={props.onCapture} label={props.label} className={props.className} />
    : <DesignViewer {...props} model={version.model} kind={version.kind} scene={mode === 'mesh' ? scene : undefined} />;
  if (!both) return stage;
  return <div className={`relative ${props.className ?? ''}`}>{stage}{switcher}</div>;
}
