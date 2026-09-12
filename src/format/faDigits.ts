const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function toFaDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[0-9]/g, digit => persianDigits[Number(digit)])
    .replace(/[٠-٩]/g, digit => persianDigits[arabicDigits.indexOf(digit)]);
}
