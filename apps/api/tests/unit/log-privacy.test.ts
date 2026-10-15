import { describe, expect, it } from 'vitest';
import { logTextForPrivacyChecks } from '../helpers';

// Regression tests for the T-11 false positive: a random request ID ("…-a454-59ae…") contains "4-5",
// the sample skin-tone range that must never be logged. Fixed IDs, so the result is deterministic.

const CI_REQUEST_ID = '93cba67a-7cc1-4b4f-a454-59aef00afa19';
const line = (entry: Record<string, unknown>) => JSON.stringify({ level: 30, time: 1792042572007, ...entry });
const request = (id: string, path = '/v1/appearance') =>
  line({ req: { id, method: 'PUT', path }, res: { statusCode: 200 }, responseTime: 5, msg: 'request completed' });

describe('logTextForPrivacyChecks', () => {
  it('Case A: a request ID that happens to contain "4-5" is not reported', () => {
    const lines = [request(CI_REQUEST_ID)];
    // The original assertion searched the raw lines and failed here.
    expect(lines.join('\n')).toContain('4-5');
    const text = logTextForPrivacyChecks(lines);
    expect(text).not.toContain('4-5');
    // Everything else on the line is still there.
    expect(text).toContain('"path":"/v1/appearance"');
    expect(text).toContain('"method":"PUT"');
    expect(text).toContain('request completed');
  });

  it('Case B: a sensitive value in the message is still found', () => {
    expect(logTextForPrivacyChecks([line({ msg: 'saved skin tone 4-5' })])).toContain('4-5');
  });

  it('Case B: a sensitive value in any other field, including nested ones, is still found', () => {
    expect(logTextForPrivacyChecks([line({ appearance: { skinTone: { monkRange: '4-5' } } })])).toContain('4-5');
    expect(logTextForPrivacyChecks([line({ event: 'appearance_saved', value: 'olive' })])).toContain('olive');
  });

  it('Case B: the same line can hold a matching request ID and a real value; the value is still found', () => {
    const both = line({ req: { id: CI_REQUEST_ID, method: 'PUT', path: '/v1/appearance' }, monkRange: '4-5' });
    expect(logTextForPrivacyChecks([both])).toContain('4-5');
  });

  it('Case B: other request fields are not removed (e.g. a value in the path)', () => {
    expect(logTextForPrivacyChecks([request(CI_REQUEST_ID, '/v1/appearance/4-5')])).toContain('4-5');
  });

  it('Case B: a req.id that is not a UUID is kept and checked', () => {
    expect(logTextForPrivacyChecks([request('skin-4-5')])).toContain('4-5');
  });

  it('Case B: lines that are not JSON are checked as they are', () => {
    expect(logTextForPrivacyChecks(['plain text mentioning 4-5'])).toContain('4-5');
    expect(logTextForPrivacyChecks(['{"truncated json 4-5'])).toContain('4-5');
  });

  it('keeps lines without a request, and the order of lines', () => {
    const lines = [line({ event: 'first' }), request(CI_REQUEST_ID), line({ event: 'last' })];
    const text = logTextForPrivacyChecks(lines).split('\n');
    expect(text).toHaveLength(3);
    expect(text[0]).toContain('first');
    expect(text[2]).toContain('last');
  });
});
