import { describe, expect, it } from 'vitest';
import {
  CITY_IDS,
  INDIAN_CITIES,
  cityLabel,
  indianPhoneSchema,
  otpSchema,
  passwordSchema,
  registerRequestSchema,
  searchCities,
} from '../src/index';

const valid = {
  fullName: 'Asha Rao',
  email: 'Asha@Example.com',
  password: 'Correct-Horse-9',
  confirmPassword: 'Correct-Horse-9',
  city: 'pune',
  acceptTerms: true,
};

describe('password policy (D-87)', () => {
  it('needs 8+ characters with upper, lower, number and special', () => {
    for (const ok of ['Correct-Horse-9', 'Aa1!aaaa', 'Pässwörd-12'])
      expect(passwordSchema.safeParse(ok).success).toBe(true);
    for (const bad of ['Aa1!aaa', 'aa1!aaaa', 'AA1!AAAA', 'Aa!aaaaa', 'Aa1aaaaa', 'x'.repeat(129)]) {
      expect(passwordSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('registration request', () => {
  it('normalises the email and defaults the optional choices to off', () => {
    const parsed = registerRequestSchema.parse(valid);
    expect(parsed.email).toBe('asha@example.com');
    expect(parsed.marketingOptIn).toBe(false);
    expect(parsed.rememberMe).toBe(false);
  });

  it('requires the terms, a listed city and matching passwords; rejects unknown fields', () => {
    expect(registerRequestSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...valid, city: 'paris' }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...valid, confirmPassword: 'Correct-Horse-8' }).success).toBe(false);
    expect(registerRequestSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });
});

describe('phone and codes', () => {
  it('normalises Indian mobile numbers to E.164', () => {
    for (const input of ['9876543210', '+91 98765 43210', '098765-43210', '919876543210', '0091 9876543210']) {
      expect(indianPhoneSchema.parse(input), input).toBe('+919876543210');
    }
    for (const bad of ['12345', '5876543210', '+1 415 555 0100'])
      expect(indianPhoneSchema.safeParse(bad).success).toBe(false);
  });

  it('codes are exactly six digits', () => {
    expect(otpSchema.safeParse('012345').success).toBe(true);
    for (const bad of ['12345', '1234567', '12a456', ' 123456']) expect(otpSchema.safeParse(bad).success).toBe(false);
  });
});

describe('Indian cities', () => {
  it('has unique IDs and labels with the state', () => {
    expect(new Set(CITY_IDS).size).toBe(CITY_IDS.length);
    expect(INDIAN_CITIES.length).toBeGreaterThan(150);
    expect(cityLabel('pune')).toBe('Pune, Maharashtra');
    expect(cityLabel('nowhere')).toBeNull();
  });

  it('keeps Amravati (Maharashtra) and Amaravati (Andhra Pradesh) apart', () => {
    expect(cityLabel('amravati')).toBe('Amravati, Maharashtra');
    expect(cityLabel('amaravati')).toBe('Amaravati, Andhra Pradesh');
    expect(searchCities('amravati').map((c) => c.id)).toEqual(['amravati']);
    // "Amaravati" is also a common spelling of the Maharashtra city, so both are offered, each with its state.
    expect(searchCities('amaravati').map((c) => c.id)).toEqual(['amaravati', 'amravati']);
  });

  it('finds cities by their other spellings and former names', () => {
    expect(searchCities('bangalore')[0]?.id).toBe('bengaluru');
    expect(searchCities('bombay')[0]?.id).toBe('mumbai');
    expect(searchCities('gurgaon')[0]?.id).toBe('gurugram');
  });
});
