import { ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { StudySet } from '@/types/studySet'
import { useStudySetFallbackImagePaths } from './hooks/useStudySetFallbackImagePaths'
import { useSignedImageUrls } from './hooks/useSignedImageUrls'

const PLACEHOLDER_BOX =
  'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-input bg-muted/50'

/**
 * An <img> that fades in once it's actually decoded, instead of popping in
 * the instant its (often just-resolved, async) src is set -- masks the gap
 * between "signed URL fetched" and "image painted".
 */
function FadeImage({ className, ...props }: React.ComponentProps<'img'>) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      {...props}
      onLoad={(e) => {
        setLoaded(true)
        props.onLoad?.(e)
      }}
      className={cn(
        'opacity-0 transition-opacity duration-150 ease-out',
        loaded && 'opacity-100',
        className,
      )}
    />
  )
}

/**
 * Thumbnail shown to the left of a study set's title/description on the
 * dashboard. Prefers the set's own custom image; otherwise falls back to a
 * stack built from that set's own card images (deterministic -- the same
 * cards every time, not re-randomized per render); otherwise a plain
 * placeholder icon.
 */
export function StudySetThumbnail({ studySet }: { studySet: StudySet }) {
  const hasCustomImage = !!studySet.image_path
  const customImage = useSignedImageUrls(hasCustomImage ? [studySet.image_path!] : [])

  const fallbackPaths = useStudySetFallbackImagePaths(studySet.id, !hasCustomImage)
  const fallbackImages = useSignedImageUrls(fallbackPaths.data ?? [])

  if (hasCustomImage) {
    const url = customImage.data?.[studySet.image_path!]
    return (
      <div className={PLACEHOLDER_BOX}>
        {url ? (
          <FadeImage src={url} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="text-muted-foreground size-6" />
        )}
      </div>
    )
  }

  const paths = fallbackPaths.data ?? []
  const urls = paths
    .map((path) => fallbackImages.data?.[path])
    .filter((url): url is string => !!url)

  if (urls.length === 0) {
    return (
      <div className={PLACEHOLDER_BOX}>
        <ImageIcon className="text-muted-foreground size-6" />
      </div>
    )
  }

  return (
    <div className="relative size-16 shrink-0 -translate-y-1">
      {urls.slice(0, 3).map((url, i) => (
        <FadeImage
          key={url}
          src={url}
          alt=""
          className={cn(
            'border-input ease-out-strong absolute inset-0 size-16 rounded-lg border object-cover transition-[opacity,translate,rotate] duration-200',
            // Darken the cards further back so the stack reads as
            // receding, not just offset. On row hover they fan out
            // further, as if the stack were spreading like a hand of
            // cards.
            i === 1 &&
              'translate-x-1.5 translate-y-1 rotate-3 brightness-60 saturate-75 motion-safe:group-hover/row:translate-x-2 motion-safe:group-hover/row:translate-y-1.5 motion-safe:group-hover/row:rotate-6',
            i === 2 &&
              '-translate-x-1 translate-y-2 -rotate-3 brightness-35 saturate-50 motion-safe:group-hover/row:-translate-x-1.5 motion-safe:group-hover/row:translate-y-2 motion-safe:group-hover/row:-rotate-6',
          )}
          style={{ zIndex: 3 - i }}
        />
      ))}
    </div>
  )
}
