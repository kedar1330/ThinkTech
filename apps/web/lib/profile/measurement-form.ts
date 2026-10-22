import {
  bodyMeasurement,
  cmToInches,
  inchesToCm,
  type BodyMeasurementId,
  type MeasurementUnit,
  type MeasurementValues,
  type UpdateMeasurementsRequest,
} from '@styleme/contracts';

// Step-by-step measurement entry (D-129). Values are typed in the unit the user picks and always saved in
// centimetres. Body-type measurements are all needed to identify a body type; fit measurements are optional.

export type Entries = Partial<Record<BodyMeasurementId, string>>;

/** A stored centimetre value shown in the chosen unit. */
export function toDisplay(cm: number | undefined, unit: MeasurementUnit): string {
  if (cm === undefined) return '';
  return String(unit === 'cm' ? cm : cmToInches(cm));
}

/** Initial entries for the stepper from stored centimetre values. */
export function entriesFrom(valuesCm: MeasurementValues, ids: readonly BodyMeasurementId[], unit: MeasurementUnit) {
  return Object.fromEntries(ids.map((id) => [id, toDisplay(valuesCm[id], unit)])) as Entries;
}

/** Re-expresses every entry when the user switches between cm and inches. */
export function convertEntries(entries: Entries, from: MeasurementUnit, to: MeasurementUnit): Entries {
  if (from === to) return entries;
  return Object.fromEntries(
    Object.entries(entries).map(([id, raw]) => {
      const n = Number(raw);
      if (!raw || !Number.isFinite(n)) return [id, raw];
      return [id, String(to === 'cm' ? inchesToCm(n) : cmToInches(n))];
    }),
  ) as Entries;
}

export type EntryCheck = { ok: true; cm: number | undefined } | { ok: false; error: string };

/** Checks one entry: empty, or a number within the measurement's plausible range. */
export function checkEntry(id: BodyMeasurementId, raw: string | undefined, unit: MeasurementUnit): EntryCheck {
  const value = (raw ?? '').trim();
  if (value === '') return { ok: true, cm: undefined };
  const n = Number(value);
  const m = bodyMeasurement(id);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `Enter your ${m.label.toLowerCase()} as a number.` };
  const cm = unit === 'cm' ? Math.round(n * 10) / 10 : inchesToCm(n);
  const [min, max] = m.rangeCm;
  if (cm < min || cm > max) {
    const range = unit === 'cm' ? `${min}–${max} cm` : `${cmToInches(min)}–${cmToInches(max)} in`;
    return { ok: false, error: `${m.label} is usually between ${range}. Please check the value and unit.` };
  }
  return { ok: true, cm };
}

export type BuildResult = { ok: true; body: UpdateMeasurementsRequest } | { ok: false; error: string; step: number };

/**
 * The PUT /v1/measurements body for these steps. With `required`, every step needs a value (body type);
 * otherwise an empty step clears that measurement (fit).
 */
export function buildMeasurementsRequest(
  ids: readonly BodyMeasurementId[],
  entries: Entries,
  unit: MeasurementUnit,
  required: boolean,
): BuildResult {
  const valuesCm: MeasurementValues = {};
  const clear: BodyMeasurementId[] = [];
  for (const [step, id] of ids.entries()) {
    const check = checkEntry(id, entries[id], unit);
    if (!check.ok) return { ok: false, error: check.error, step };
    if (check.cm === undefined) {
      if (required) return { ok: false, error: `Add your ${bodyMeasurement(id).label.toLowerCase()}.`, step };
      clear.push(id);
    } else {
      valuesCm[id] = check.cm;
    }
  }
  return { ok: true, body: { displayUnit: unit, valuesCm, ...(clear.length ? { clear } : {}) } };
}
