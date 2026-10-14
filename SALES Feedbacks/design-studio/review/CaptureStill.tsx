import { useMemo } from 'react';
import type { Capture, DesignFile, ModelParams } from '../data/designStudio';
import { renderStill } from '../viewer/renderArch';
import { useMeshScene } from '../viewer/meshLoaders';
import { useFileUrl } from '../store/fileStore';
import StrokeLayer from '../markup/StrokeLayer';

/** A capture's frozen still, re-rendered from its stored camera, with markup burned in.
 *  Uploaded designs: re-rendered from the parsed mesh, or the frozen uploaded image. */
export default function CaptureStill({ capture, model, files, width = 480, className = '', children }: {
  capture: Capture;
  model: ModelParams;
  /** The version's uploaded files (mesh designs re-render from them). */
  files?: DesignFile[];
  width?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const imageUrl = useFileUrl(capture.imageFileId);
  const meshFiles = (files ?? []).filter(f => f.kind === 'mesh');
  const scene = useMeshScene(meshFiles);
  const meshKey = meshFiles.map(f => f.id).join('|');
  const src = useMemo(() => {
    if (capture.uploadedImage) return capture.uploadedImage;
    if (capture.imageFileId) return imageUrl || '';
    if (meshKey && scene === undefined) return '';
    return renderStill(model, capture.camera, { stage: capture.stage }, width, scene ?? undefined, meshKey);
  }, [capture.uploadedImage, capture.imageFileId, imageUrl, capture.camera, capture.stage, model, width, scene, meshKey]);

  return (
    <div className={`relative aspect-[16/10] bg-[#F0F2F7] overflow-hidden ${className}`}>
      {src && <img src={src} alt={capture.thumbnailLabel} className={`absolute inset-0 w-full h-full select-none ${capture.imageFileId ? 'object-contain' : 'object-cover'}`} draggable={false} />}
      {children ?? <StrokeLayer strokes={capture.strokes} />}
    </div>
  );
}
