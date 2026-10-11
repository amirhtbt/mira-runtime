/** Canonical contact text; keep punctuation and non-Iranian country codes. */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '');
  return compact.replace(/^(?:\+98|0098)/, '0').replace(/^989(?=\d{9}$)/, '09');
}
