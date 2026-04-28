// Small pure helpers shared across pages.

export function moveItem<T>(arr: T[], idx: number, dir: number): T[] {
 const newIdx = idx + dir;
 if (newIdx < 0 || newIdx >= arr.length) return arr;
 const next = arr.slice();
 const tmp = next[idx];
 next[idx] = next[newIdx];
 next[newIdx] = tmp;
 return next;
}

export function newId(): string {
 return "id_" + Math.random().toString(36).slice(2, 9);
}

export function slugify(s: string): string {
 return (s || "")
 .toLowerCase()
 .normalize("NFD")
 .replace(/[̀-ͯ]/g, "")
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/^-|-$/g, "")
 .slice(0, 40);
}

export function isSameDay(a: Date, b: Date): boolean {
 return (
 a.getFullYear() === b.getFullYear() &&
 a.getMonth() === b.getMonth() &&
 a.getDate() === b.getDate()
 );
}

export function formatTime(date: Date): string {
 return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatTimeShort(iso: string): string {
 return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function minutesSince(iso: string): number {
 return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function formatDayLabel(date: Date): string {
 const today = new Date();
 const tomorrow = new Date();
 tomorrow.setDate(today.getDate() + 1);
 if (isSameDay(date, today)) return "Today";
 if (isSameDay(date, tomorrow)) return "Tomorrow";
 return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

export function formatPrice(num: number, currencySymbol = "€"): string {
 return currencySymbol + num.toFixed(2);
}



// Parse a decimal-like user-entered string. Accepts both "12.50" and "12,50" since some
// locales use the comma as the decimal separator. Returns NaN when the input is not a
// recognisable number.
// Filter user input for price fields: keep only digits and dots, replace commas with
// dots on the fly so users can type comma decimal separators naturally.
export function sanitizePriceInput(value: string): string {
 return value.replace(/,/g, ".").replace(/[^\d.]/g, "");
}

export function parseDecimal(value: string | null | undefined): number {
 if (value === null || value === undefined) return NaN;
 const normalized = String(value).replace(",", ".").trim();
 if (normalized.length === 0) return NaN;
 return parseFloat(normalized);
}

export function currencySymbolOf(code: string): string {
 switch (code) {
 case "EUR": return "€";
 case "USD": return "$";
 case "GBP": return "£";
 case "RUB": return "₽";
 case "UAH": return "₴";
 case "BRL": return "R$";
 case "MXN": return "$";
 case "ARS": return "$";
 case "CLP": return "$";
 case "COP": return "$";
 case "TRY": return "₺";
 default: return code + " ";
 }
}
