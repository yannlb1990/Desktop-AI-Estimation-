import { useEffect, useState } from 'react';
import { photoUrl } from '@/lib/site/siteStore';
import type { SitePhoto } from '@/lib/site/visit';

/** A site photo, from this device or the cloud; click to see it full size. */
export function SitePhotoThumb({ photo, onOpen, size = 'h-16 w-16' }: { photo: SitePhoto; onOpen: (url: string, caption: string) => void; size?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    photoUrl(photo).then(u => { url = u; setSrc(u); setTried(true); });
    return () => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [photo.id, photo.path]);
  if (!src) {
    return (
      <div className={`grid ${size} place-items-center rounded border border-border p-1 text-center text-[10px] leading-tight text-muted-foreground`}>
        {!photo.path ? 'not uploaded from the phone yet' : tried ? 'could not load' : 'loading'}
      </div>
    );
  }
  return (
    <button type="button" title={photo.caption || 'Open the photo'} onClick={() => onOpen(src, photo.caption)}
      className={`${size} overflow-hidden rounded border border-border bg-muted`}>
      <img src={src} alt={photo.caption || ''} className="h-full w-full object-cover" />
    </button>
  );
}

/** A photo full size over the page; click anywhere to close. */
export function SitePhotoViewer({ photo, onClose }: { photo: { url: string; caption: string } | null; onClose: () => void }) {
  if (!photo) return null;
  return (
    <div className="fixed inset-0 z-[10050] grid place-items-center bg-black/85 p-6 print:hidden" onClick={onClose}>
      <figure className="max-h-full max-w-full text-center">
        <img src={photo.url} alt={photo.caption} className="max-h-[85vh] max-w-full rounded-lg" />
        {photo.caption && <figcaption className="mt-2 text-sm text-white/90">{photo.caption}</figcaption>}
      </figure>
      <button type="button" className="absolute right-6 top-6 rounded-md bg-card px-3 py-1.5 text-sm">Close</button>
    </div>
  );
}
