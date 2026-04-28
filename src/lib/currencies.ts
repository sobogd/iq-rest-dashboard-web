// Full list of world currencies with their symbols
export const CURRENCIES = [
  // Major currencies first
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },

  // European currencies
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "BGN", symbol: "лв", name: "Bulgarian Lev" },
  { code: "HRK", symbol: "kn", name: "Croatian Kuna" },
  { code: "RSD", symbol: "дин.", name: "Serbian Dinar" },
  { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "ISK", symbol: "kr", name: "Icelandic Króna" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },

  // Americas
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "ARS", symbol: "AR$", name: "Argentine Peso" },
  { code: "CLP", symbol: "CL$", name: "Chilean Peso" },
  { code: "COP", symbol: "CO$", name: "Colombian Peso" },
  { code: "PEN", symbol: "S/", name: "Peruvian Sol" },

  // Asia & Middle East
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel" },
  { code: "QAR", symbol: "﷼", name: "Qatari Riyal" },
  { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar" },
  { code: "BHD", symbol: "د.ب", name: "Bahraini Dinar" },
  { code: "OMR", symbol: "ر.ع.", name: "Omani Rial" },
  { code: "JOD", symbol: "د.ا", name: "Jordanian Dinar" },
  { code: "LBP", symbol: "ل.ل", name: "Lebanese Pound" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee" },

  // Africa
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "EGP", symbol: "£", name: "Egyptian Pound" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
  { code: "MAD", symbol: "د.م.", name: "Moroccan Dirham" },
  { code: "TND", symbol: "د.ت", name: "Tunisian Dinar" },
  { code: "XOF", symbol: "CFA", name: "West African CFA Franc" },
  { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc" },

  // Oceania
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "FJD", symbol: "FJ$", name: "Fiji Dollar" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

/**
 * Get currency info by code
 */
export function getCurrency(code: string) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]; // Default to EUR
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(code: string): string {
  return getCurrency(code).symbol;
}

/**
 * Format price with currency symbol
 * @param amount - The price amount
 * @param currencyCode - ISO 4217 currency code (e.g., "EUR", "USD")
 * @returns Formatted price string (e.g., "€12.50", "$12.50")
 */
// Currencies that don't use decimal places
const ZERO_DECIMAL_CURRENCIES = ["JPY", "KRW", "VND", "CLP", "ISK", "HUF", "XOF", "XAF"];

export function formatPrice(amount: number, currencyCode: string = "EUR"): string {
  const currency = getCurrency(currencyCode);

  // For currencies that typically show symbol after the number
  const symbolAfter = ["PLN", "CZK", "HUF", "SEK", "NOK", "DKK", "ISK"].includes(currencyCode);

  // Zero-decimal currencies don't show decimals
  const formattedAmount = ZERO_DECIMAL_CURRENCIES.includes(currencyCode)
    ? Math.round(amount).toString()
    : amount.toFixed(2);

  if (symbolAfter) {
    return `${formattedAmount} ${currency.symbol}`;
  }

  return `${currency.symbol}${formattedAmount}`;
}
