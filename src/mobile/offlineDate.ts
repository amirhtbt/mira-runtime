// Match the server's JalaliDate conversion from a Gregorian civil date.
function jalali(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const monthOffsets = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy = year - (year <= 1600 ? 621 : 1600);
  const leapYear = month > 2 ? gy + 1 : gy;
  const div = Math.trunc;
  let days = 365 * gy + div((leapYear + 3) / 4) - div((leapYear + 99) / 100)
    + div((leapYear + 399) / 400) - 80 + day + monthOffsets[month - 1];

  let jy = (year <= 1600 ? 0 : 979) + 33 * div(days / 12053);
  days %= 12053;
  jy += 4 * div(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += div((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days / 31) : 7 + div((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [String(jy).padStart(4, '0'), String(jm).padStart(2, '0'), String(jd).padStart(2, '0')].join('/');
}

const tehranCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: 'numeric', day: 'numeric',
});

export function offlineDates(now: Date, validityDays: number | null) {
  const parts = new Map(tehranCalendar.formatToParts(now).map(part => [part.type, Number(part.value)]));
  const date = new Date(Date.UTC(parts.get('year')!, parts.get('month')! - 1, parts.get('day')!));
  const issueDate = jalali(date);
  if (validityDays === null) return { issueDate, validUntil: null };
  date.setUTCDate(date.getUTCDate() + validityDays);
  return { issueDate, validUntil: jalali(date) };
}
