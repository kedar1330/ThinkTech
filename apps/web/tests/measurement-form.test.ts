import { describe, expect, it } from 'vitest';
import { MEASUREMENT_ORDER } from '@styleme/contracts';
import {
  buildMeasurementsRequest,
  checkEntry,
  convertEntries,
  entriesFrom,
  toDisplay,
} from '../lib/profile/measurement-form';

// Step-by-step measurement entry (D-129).

describe('measurement form', () => {
  it('shows stored centimetres in the chosen unit', () => {
    expect(toDisplay(76.2, 'in')).toBe('30');
    expect(toDisplay(76.2, 'cm')).toBe('76.2');
    expect(toDisplay(undefined, 'cm')).toBe('');
    expect(entriesFrom({ waist: 76.2 }, ['waist', 'hip'], 'in')).toEqual({ waist: '30', hip: '' });
  });

  it('converts typed values when the unit changes, keeping empty or unfinished entries', () => {
    expect(convertEntries({ waist: '30', hip: '', bust: 'abc' }, 'in', 'cm')).toEqual({
      waist: '76.2',
      hip: '',
      bust: 'abc',
    });
    expect(convertEntries({ waist: '76.2' }, 'cm', 'in')).toEqual({ waist: '30' });
  });

  it('checks each value against the measurement’s plausible range, in either unit', () => {
    expect(checkEntry('waist', '30', 'in')).toEqual({ ok: true, cm: 76.2 });
    expect(checkEntry('waist', '', 'in')).toEqual({ ok: true, cm: undefined });
    const tooSmall = checkEntry('waist', '30', 'cm');
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.error).toMatch(/Waist is usually between 45–170 cm/);
    expect(checkEntry('wrist', 'x', 'cm').ok).toBe(false);
  });

  it('body type: every measurement is required, and the failing step is reported', () => {
    const ids = MEASUREMENT_ORDER.women.body_type;
    const missing = buildMeasurementsRequest(ids, { shoulder: '39', bust: '36', waist: '28' }, 'in', true);
    expect(missing).toEqual({ ok: false, error: 'Add your hip.', step: 3 });

    const ok = buildMeasurementsRequest(
      ids,
      { shoulder: '39', bust: '36', waist: '28', hip: '38', highHip: '33' },
      'in',
      true,
    );
    expect(ok).toEqual({
      ok: true,
      body: { displayUnit: 'in', valuesCm: { shoulder: 99.1, bust: 91.4, waist: 71.1, hip: 96.5, highHip: 83.8 } },
    });
  });

  it('fit: empty steps are cleared rather than required', () => {
    const res = buildMeasurementsRequest(['neck', 'wrist', 'inseam'], { neck: '38', inseam: '' }, 'cm', false);
    expect(res).toEqual({ ok: true, body: { displayUnit: 'cm', valuesCm: { neck: 38 }, clear: ['wrist', 'inseam'] } });
  });
});
