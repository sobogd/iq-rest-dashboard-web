// Shared helpers for admin pages (sessions, companies).

export function countryToFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "";
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset,
  );
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTimeDiff(date1: string, date2: string): string {
  const diff = Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) / 1000;
  if (diff < 1) return "0s";
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    const secs = Math.round(diff % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    const mins = Math.round((diff % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.round((diff % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hours}:${mins}`;
}

export function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(iso: string, tz?: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(tz && { timeZone: tz }),
  });
}

export const COUNTRY_TZ: Record<string, string> = {
  US: "America/New_York", CA: "America/Toronto", MX: "America/Mexico_City",
  BR: "America/Sao_Paulo", AR: "America/Buenos_Aires", CO: "America/Bogota",
  CL: "America/Santiago", PE: "America/Lima", VE: "America/Caracas",
  GB: "Europe/London", IE: "Europe/Dublin", IS: "Atlantic/Reykjavik",
  DE: "Europe/Berlin", FR: "Europe/Paris", ES: "Europe/Madrid",
  IT: "Europe/Rome", PT: "Europe/Lisbon", NL: "Europe/Amsterdam",
  BE: "Europe/Brussels", AT: "Europe/Vienna", CH: "Europe/Zurich",
  PL: "Europe/Warsaw", CZ: "Europe/Prague", SK: "Europe/Bratislava",
  HU: "Europe/Budapest", RO: "Europe/Bucharest", BG: "Europe/Sofia",
  HR: "Europe/Zagreb", SI: "Europe/Ljubljana", RS: "Europe/Belgrade",
  UA: "Europe/Kyiv", RU: "Europe/Moscow", BY: "Europe/Minsk",
  SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki", EE: "Europe/Tallinn", LV: "Europe/Riga",
  LT: "Europe/Vilnius", GR: "Europe/Athens", TR: "Europe/Istanbul",
  GE: "Asia/Tbilisi", AM: "Asia/Yerevan", AZ: "Asia/Baku",
  KZ: "Asia/Almaty", UZ: "Asia/Tashkent",
  IL: "Asia/Jerusalem", SA: "Asia/Riyadh", AE: "Asia/Dubai",
  IR: "Asia/Tehran", IQ: "Asia/Baghdad", JO: "Asia/Amman",
  IN: "Asia/Kolkata", PK: "Asia/Karachi", BD: "Asia/Dhaka",
  JP: "Asia/Tokyo", KR: "Asia/Seoul", CN: "Asia/Shanghai",
  TW: "Asia/Taipei", HK: "Asia/Hong_Kong", SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur", TH: "Asia/Bangkok", VN: "Asia/Ho_Chi_Minh",
  ID: "Asia/Jakarta", PH: "Asia/Manila",
  AU: "Australia/Sydney", NZ: "Pacific/Auckland",
  EG: "Africa/Cairo", ZA: "Africa/Johannesburg", NG: "Africa/Lagos",
  KE: "Africa/Nairobi", MA: "Africa/Casablanca",
};

export function formatEventName(event: string, labels: Record<string, string>): string {
  if (labels[event]) return labels[event];
  if (event.startsWith("section_view_")) {
    const section = event.replace("section_view_", "").replace(/_/g, " ");
    return `Section: ${section.charAt(0).toUpperCase() + section.slice(1)}`;
  }
  if (event.startsWith("page_view_")) {
    const page = event.replace("page_view_", "").replace(/_/g, " ");
    return `Visited ${page.charAt(0).toUpperCase() + page.slice(1)}`;
  }
  return event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
