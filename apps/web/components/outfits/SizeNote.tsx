import Link from 'next/link';
import type { Category, ProfileSizes } from '@styleme/contracts';
import { sizeNoteFor } from '@/lib/discover/size-note';

/** Size note for one look slot (FR-SIZE-04). Used on the results (#47) and saved-look (#41) pages. */
export function SizeNote({ category, sizes }: { category: Category; sizes: ProfileSizes }) {
  const note = sizeNoteFor(category, sizes);
  if (note.kind === 'none') return null;
  if (note.kind === 'size')
    return (
      <p className="text-xs text-muted-foreground">
        Your saved size: <span className="font-medium text-foreground">{note.value}</span>
      </p>
    );
  return (
    <p className="text-xs text-muted-foreground">
      No saved size for this item.{' '}
      <Link href="/profile#sizes" className="font-medium text-plum underline">
        Add your size
      </Link>
    </p>
  );
}
