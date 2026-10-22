import Link from 'next/link';
import {
  COLORS,
  DEPARTMENTS,
  GARMENT_LENGTHS,
  NECKLINE_DEPTHS,
  SLEEVE_LENGTHS,
  departmentScope,
  type ProfileResponse,
} from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';

// The profile values a look request applies (FR-LOOK-01), with a way to change them.

const label = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((o) => o.id === id)?.label ?? id;

function sizeLines({ sizes }: ProfileResponse): string[] {
  const lines: string[] = [];
  if (sizes.tops)
    lines.push(`Tops ${sizes.tops.letter}${sizes.tops.collarIn ? `, collar ${sizes.tops.collarIn} in` : ''}`);
  if (sizes.bottoms)
    lines.push(
      `Bottoms waist ${sizes.bottoms.waistIn} in${sizes.bottoms.lengthIn ? `, length ${sizes.bottoms.lengthIn} in` : ''}`,
    );
  if (sizes.ethnicTops) lines.push(`Ethnic tops ${sizes.ethnicTops.letter ?? `${sizes.ethnicTops.numeric} in`}`);
  if (sizes.ethnicSets) lines.push(`Ethnic sets ${sizes.ethnicSets.letter ?? `waist ${sizes.ethnicSets.waistIn} in`}`);
  if (sizes.shoes) lines.push(`Shoes UK ${sizes.shoes.uk}`);
  return lines;
}

function coverageLines({ coveragePreferences: c }: ProfileResponse): string[] {
  const lines: string[] = [];
  if (c.minSleeveLength) lines.push(`Sleeves at least ${label(SLEEVE_LENGTHS, c.minSleeveLength).toLowerCase()}`);
  if (c.minNecklineCoverage)
    lines.push(`Neckline no lower than ${label(NECKLINE_DEPTHS, c.minNecklineCoverage).toLowerCase()}`);
  if (c.minGarmentLength) lines.push(`Length at least ${label(GARMENT_LENGTHS, c.minGarmentLength).toLowerCase()}`);
  return lines;
}

function Row({ term, values }: { term: string; values: string[] }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="text-sm">{values.length ? values.join(' · ') : 'Not set'}</dd>
    </div>
  );
}

export function ProfileSummary({ profile }: { profile: ProfileResponse }) {
  const scope = departmentScope(profile);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-primary">From your profile</h2>
        <Link href="/profile#basics" className="text-sm font-medium text-plum underline">
          Edit profile
        </Link>
      </div>
      {!scope.filterApplied && (
        <Alert tone="info">No department filter applied: looks can come from every department.</Alert>
      )}
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row term="Department" values={profile.department ? [label(DEPARTMENTS, profile.department)] : []} />
        <Row term="Sizes" values={sizeLines(profile)} />
        <Row term="Colours you like" values={profile.likedColors.map((id) => label(COLORS, id))} />
        <Row term="Colours you avoid" values={profile.dislikedColors.map((id) => label(COLORS, id))} />
        <Row term="Coverage" values={coverageLines(profile)} />
      </dl>
    </Card>
  );
}
