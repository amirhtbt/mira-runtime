import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';
describe('contact normalization', () => {
  it.each(['0912 123 4567', '+98 912 123 4567', '۰۰۹۸ ۹۱۲ ۱۲۳ ۴۵۶۷', '+۹۸\u00a0۹۱۲\u200f۱۲۳\n۴۵۶۷', '989121234567'])('normalizes copied Iranian number %s', value => expect(normalizePhone(value)).toBe('09121234567'));
  it('supports landlines and preserves other country codes', () => {
    expect(normalizePhone('+98 21 8888 1234')).toBe('02188881234');
    expect(normalizePhone('+49 123 456')).toBe('+49123456');
    expect(normalizePhone('021-88881234')).toBe('021-88881234');
  });
});
