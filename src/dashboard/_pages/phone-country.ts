// Map an international phone number (digits, no "+") to a country flag emoji
// via its dialing code (longest-prefix match). Not exhaustive — covers the
// common ranges; unknown codes return "".

// Dialing code → ISO 3166-1 alpha-2. Multi-owner codes resolve to the most
// likely single country for display purposes.
const DIAL_TO_ISO: Record<string, string> = {
  "1": "US", "7": "RU",
  "20": "EG", "27": "ZA", "30": "GR", "31": "NL", "32": "BE", "33": "FR",
  "34": "ES", "36": "HU", "39": "IT", "40": "RO", "41": "CH", "43": "AT",
  "44": "GB", "45": "DK", "46": "SE", "47": "NO", "48": "PL", "49": "DE",
  "51": "PE", "52": "MX", "53": "CU", "54": "AR", "55": "BR", "56": "CL",
  "57": "CO", "58": "VE", "60": "MY", "61": "AU", "62": "ID", "63": "PH",
  "64": "NZ", "65": "SG", "66": "TH", "81": "JP", "82": "KR", "84": "VN",
  "86": "CN", "90": "TR", "91": "IN", "92": "PK", "93": "AF", "94": "LK",
  "95": "MM", "98": "IR",
  "212": "MA", "213": "DZ", "216": "TN", "218": "LY", "220": "GM", "221": "SN",
  "234": "NG", "251": "ET", "254": "KE", "255": "TZ", "256": "UG",
  "351": "PT", "352": "LU", "353": "IE", "354": "IS", "355": "AL", "356": "MT",
  "357": "CY", "358": "FI", "359": "BG", "370": "LT", "371": "LV", "372": "EE",
  "373": "MD", "374": "AM", "375": "BY", "376": "AD", "377": "MC", "378": "SM",
  "380": "UA", "381": "RS", "382": "ME", "383": "XK", "385": "HR", "386": "SI",
  "387": "BA", "389": "MK", "420": "CZ", "421": "SK", "423": "LI",
  "971": "AE", "972": "IL", "973": "BH", "974": "QA", "966": "SA", "962": "JO",
  "961": "LB", "964": "IQ", "965": "KW", "968": "OM", "967": "YE",
  "852": "HK", "853": "MO", "886": "TW", "880": "BD", "856": "LA", "855": "KH",
  "994": "AZ", "995": "GE", "996": "KG", "998": "UZ", "992": "TJ", "993": "TM",
};

export function phoneToCountryIso(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  for (let len = 4; len >= 1; len--) {
    const code = digits.slice(0, len);
    if (DIAL_TO_ISO[code]) return DIAL_TO_ISO[code];
  }
  return null;
}

export function iso2ToFlag(iso: string | null | undefined): string {
  if (!iso || iso.length !== 2) return "";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  const up = iso.toUpperCase();
  return String.fromCodePoint(A + up.charCodeAt(0) - a, A + up.charCodeAt(1) - a);
}

/** Country flag emoji for a phone number, or "" if the code is unknown. */
export function phoneToFlag(phone: string | null | undefined): string {
  return iso2ToFlag(phoneToCountryIso(phone));
}
