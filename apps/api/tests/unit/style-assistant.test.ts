import { describe, expect, it } from 'vitest';
import { buildPlanPrompt, buildReplyPrompt } from '../../src/integrations/ai/prompts/style-assistant-v1';
import { keywordPlan } from '../../src/services/style-assistant.service';

// The Style Assistant's keyword planner (D-136): used whenever Gemini is not available.

describe('keywordPlan', () => {
  it.each([
    ['What should I wear to a sangeet?', 'looks', 'wedding'],
    ['Diwali outfit ideas', 'looks', 'festive'],
    ['Something for an interview', 'looks', 'work'],
    ['Summer outfits please', 'looks', 'everyday'],
    ['Which colours suit me?', 'colours', null],
    ['Show me my palettes', 'palettes', null],
    ['Design a kurta with bell sleeves', 'design', null],
    ['Show my saved outfits', 'saved', null],
    ['Where can I buy a party dress?', 'shop', 'party'],
    ['Can I try it on?', 'try_on', null],
    ['How do I update my body type?', 'profile', null],
    ['Hi there', 'help', null],
    ['How do I wash silk?', 'general', null],
  ] as const)('%s → %s', (message, intent, occasion) => {
    expect(keywordPlan(message)).toMatchObject({ intent, occasion });
  });

  it('reads wear types and keeps the words as the design brief', () => {
    expect(keywordPlan('An indo-western look for a party').wearTypes).toEqual(['fusion']);
    expect(keywordPlan('Traditional wedding look').wearTypes).toEqual(['indian']);
    expect(keywordPlan('Design a green anarkali').designDescription).toBe('Design a green anarkali');
  });
});

describe('prompts', () => {
  it('the planner sees only the questions; the reply writer only the facts', () => {
    const plan = buildPlanPrompt({ message: 'Looks for Eid', earlier: ['Hello'] });
    expect(plan).toContain('"Looks for Eid"');
    expect(plan).toContain('"Hello"');
    const reply = buildReplyPrompt({ question: 'Q', intent: 'looks', facts: ['Look 1: Navy kurta'] });
    expect(reply).toContain('- Look 1: Navy kurta');
    expect(reply).toContain('Never invent');
  });
});
