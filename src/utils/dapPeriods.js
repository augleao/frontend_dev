// Utilities for DAP 4 fixed periods inside a month
// Periods by calendar day:
// P1: 1..7, P2: 8..14, P3: 15..21, P4: 22..lastDay

/**
 * Get period number (1..4) from day of month (1..31)
 * @param {number} day
 * @returns {1|2|3|4}
 */
export function periodoFromDay(day) {
  if (day >= 1 && day <= 7) return 1;
  if (day >= 8 && day <= 14) return 2;
  if (day >= 15 && day <= 21) return 3;
  return 4; // 22..fim
}

/**
 * Get period number (1..4) from a JS Date or date-like value
 * @param {Date|string|number} dateLike
 * @returns {1|2|3|4}
 */
export function periodoFromDate(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const day = d.getDate();
  return periodoFromDay(day);
}

/**
 * Get last day number of a given year and month (1..12)
 * @param {number} year
 * @param {number} month1to12
 * @returns {number}
 */
export function lastDayOfMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

/**
 * Get [start, end] ranges (inclusive) for the 4 DAP periods in a month.
 * @param {number} year
 * @param {number} month1to12
 * @returns {Array<{periodo:1|2|3|4, start: Date, end: Date}>}
 */
export function periodRanges(year, month1to12) {
  const last = lastDayOfMonth(year, month1to12);
  const mk = (day) => new Date(year, month1to12 - 1, day);
  return [
    { periodo: 1, start: mk(1), end: mk(7) },
    { periodo: 2, start: mk(8), end: mk(14) },
    { periodo: 3, start: mk(15), end: mk(21) },
    { periodo: 4, start: mk(22), end: mk(last) },
  ];
}

export default {
  periodoFromDay,
  periodoFromDate,
  lastDayOfMonth,
  periodRanges,
};
