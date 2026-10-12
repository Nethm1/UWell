const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function appointmentDateTime(appointment, now = new Date()) {
  const raw = String(appointment?.date || '').trim();
  if (!raw) return null;

  let year = now.getFullYear();
  let month;
  let day;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    [, year, month, day] = iso.map(Number);
    month -= 1;
  } else if (/^today$/i.test(raw)) {
    month = now.getMonth();
    day = now.getDate();
  } else if (/^tomorrow$/i.test(raw)) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    month = tomorrow.getMonth();
    day = tomorrow.getDate();
    year = tomorrow.getFullYear();
  } else {
    const match = raw.match(/^(?:[A-Za-z]{3,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
    if (!match) {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    } else {
      month = MONTHS.findIndex((name) => name === match[1].slice(0, 3).toLowerCase());
      day = Number(match[2]);
      if (match[3]) year = Number(match[3]);
      else {
        const candidateDay = new Date(year, month, day);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayDifference = (candidateDay.getTime() - today.getTime()) / 86400000;
        if (dayDifference < -180) year += 1;
      }
    }
  }

  if (month < 0 || month > 11 || !day) return null;
  const result = new Date(year, month, day);
  const time = String(appointment?.time || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (time) {
    let hours = Number(time[1]);
    const minutes = Number(time[2] || 0);
    const meridiem = String(time[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    result.setHours(hours, minutes, 0, 0);
  }
  return Number.isNaN(result.getTime()) ? null : result;
}

export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}
