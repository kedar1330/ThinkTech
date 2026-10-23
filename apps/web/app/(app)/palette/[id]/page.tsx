import { redirect } from 'next/navigation';

/**
 * The generic curated palettes were removed from My Colour Palette (#105). Old links and bookmarks to a palette
 * go to the user's own colours instead of a dead page.
 */
export default function PaletteDetailPage() {
  redirect('/palette');
}
