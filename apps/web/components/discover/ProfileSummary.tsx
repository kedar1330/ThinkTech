import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AGE_GROUPS,
  CLOTHING_PREFERENCES,
  MONK_TONES,
  UNDERTONES,
  bodyTypeLabel,
  departmentScope,
  type AppearanceResponse,
  type ColourItem,
  type ColourPreferencesResponse,
  type ProfileResponse,
} from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';

// The profile values a look request applies (FR-LOOK-01), with a way to change them. Since D-129 these are
// what My Profile asks for (Clothing Preference, height, skin tone and undertone, body type) plus the liked and
// avoided colours saved in the colour library (D-133); fit, coverage and the rest are asked per request below.

const label = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((o) => o.id === id)?.label ?? id;

function Row({ term, href, children }: { term: string; href: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="text-sm">
        {children ?? (
          <Link href={href} className="text-plum underline">
            Not set — add it
          </Link>
        )}
      </dd>
    </div>
  );
}

function Swatches({ colours }: { colours: ColourItem[] }) {
  if (!colours.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {colours.map((c) => (
        <li key={c.colourId} className="flex items-center gap-1.5">
          <span aria-hidden className="size-3.5 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
          {c.name}
        </li>
      ))}
    </ul>
  );
}

export function ProfileSummary({
  profile,
  appearance,
  colours,
}: {
  profile: ProfileResponse;
  appearance: AppearanceResponse | null;
  /** Leave out where the page shows the colours itself (Discover My Style has its own "Your colours" panel). */
  colours?: ColourPreferencesResponse | null;
}) {
  const scope = departmentScope(profile);
  const department = scope.filterApplied ? label(CLOTHING_PREFERENCES, profile.department!) : null;
  const monkTone = appearance?.skinTone ? Number(appearance.skinTone.value.monkRange.split('-')[0]) : null;
  const undertone = appearance?.undertone?.value;
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
        <Row term="Clothing preference" href="/profile#basics">
          {department}
        </Row>
        <Row term="Age group" href="/profile#basics">
          {profile.ageGroup ? label(AGE_GROUPS, profile.ageGroup) : null}
        </Row>
        <Row term="Height" href="/profile#basics">
          {profile.heightCm ? `${profile.heightCm} cm` : null}
        </Row>
        <Row term="Budget per look" href="/profile#basics">
          {profile.budgetPreference ? `₹${profile.budgetPreference.toLocaleString('en-IN')}` : null}
        </Row>
        <Row term="Skin tone & undertone" href="/profile#skin-tone">
          {monkTone ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3.5 rounded-full border border-border"
                style={{ backgroundColor: MONK_TONES[monkTone - 1]?.hex }}
              />
              Tone {monkTone}
              {undertone && undertone !== 'not_sure' ? `, ${label(UNDERTONES, undertone)}` : ''}
            </span>
          ) : null}
        </Row>
        <Row term="Body type" href="/profile#body-type">
          {appearance?.bodyType ? bodyTypeLabel(appearance.bodyType.value) : null}
        </Row>
        {colours !== undefined && (
          <>
            <Row term="Colours you like" href="/palette/colours">
              {colours?.liked.length ? <Swatches colours={colours.liked} /> : null}
            </Row>
            <Row term="Colours you avoid" href="/palette/colours">
              {colours?.avoided.length ? <Swatches colours={colours.avoided} /> : null}
            </Row>
          </>
        )}
      </dl>
    </Card>
  );
}
