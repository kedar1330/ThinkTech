import { afterEach } from 'vitest';

// Component tests run in jsdom (`// @vitest-environment jsdom`); Node tests skip the DOM setup.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
