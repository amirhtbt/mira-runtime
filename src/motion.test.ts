import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldReduceMotion } from './motion';

describe('motion policy', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('honors the user reduced-motion preference', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    expect(shouldReduceMotion()).toBe(true);
  });
  it('downgrades motion on constrained devices', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { hardwareConcurrency: 2, deviceMemory: 2 });
    expect(shouldReduceMotion()).toBe(true);
  });
  it('keeps feedback motion on capable devices', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    expect(shouldReduceMotion()).toBe(false);
  });
});
