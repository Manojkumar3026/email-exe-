export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDistanceFromNow(epochMs: number): string {
  const diffSeconds = Math.round((epochMs - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secondsInUnit] of units) {
    if (abs >= secondsInUnit || unit === 'second') {
      return formatter.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return formatter.format(0, 'second');
}
