import { CATEGORIES, type Category, type ProfileSizes } from '@styleme/contracts';

// The size note on a look slot (FR-SIZE-04): the user's saved size for the slot's category group, a
// prompt to add one, or nothing for free-size items. It only repeats the saved size; it never suggests
// a different one, and body shape or appearance signals never change it (FR-SIZE-03).

export type SizeNote = { kind: 'size'; value: string } | { kind: 'missing' } | { kind: 'none' };

const MISSING: SizeNote = { kind: 'missing' };
const NONE: SizeNote = { kind: 'none' };
const size = (value: string): SizeNote => ({ kind: 'size', value });

export function sizeNoteFor(category: Category, sizes: ProfileSizes): SizeNote {
  const group = CATEGORIES.find((c) => c.id === category)?.group;
  switch (group) {
    case 'tops':
      return sizes.tops
        ? size(`${sizes.tops.letter}${sizes.tops.collarIn ? `, collar ${sizes.tops.collarIn} in` : ''}`)
        : MISSING;
    case 'bottoms':
      return sizes.bottoms
        ? size(
            `Waist ${sizes.bottoms.waistIn} in${sizes.bottoms.lengthIn ? `, length ${sizes.bottoms.lengthIn} in` : ''}`,
          )
        : MISSING;
    case 'ethnicTops':
      return sizes.ethnicTops ? size(sizes.ethnicTops.letter ?? `${sizes.ethnicTops.numeric} in`) : MISSING;
    case 'ethnicSets':
      return sizes.ethnicSets ? size(sizes.ethnicSets.letter ?? `Waist ${sizes.ethnicSets.waistIn} in`) : MISSING;
    case 'shoes':
      return sizes.shoes ? size(`UK ${sizes.shoes.uk}`) : MISSING;
    default:
      // Free size has no size. Dresses (Stage 2) have no profile size field yet, so a prompt could not be acted on.
      return NONE;
  }
}
