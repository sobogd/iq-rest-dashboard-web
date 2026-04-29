/** next-intl-compatible facade over react-i18next so source code copied from
 *  the soqrmenuweb dashboard works unchanged. */
import { useTranslation } from "react-i18next";

type Params = Record<string, unknown>;

interface TranslateFn {
  (key: string, params?: Params): string;
  raw: (key: string) => unknown;
}

export function useTranslations<_NS extends string = string>(namespace?: _NS): TranslateFn {
  const { t } = useTranslation();
  const resolve = (key: string) => (namespace ? `${namespace}.${key}` : key);
  const fn = ((key: string, params?: Params) =>
    t(resolve(key), params as never) as unknown as string) as TranslateFn;
  fn.raw = (key: string) => t(resolve(key), { returnObjects: true }) as unknown;
  return fn;
}

// Project-wide locale guarantee: only the short codes "en" or "es" leak
// to consumers. i18next-browser-languagedetector can otherwise hand back
// a regional tag like "en-US" / "es-419" depending on the browser, which
// breaks our /<locale>/... URL contract.
const SUPPORTED = ["en", "es"] as const;
type SupportedLocale = (typeof SUPPORTED)[number];

export function useLocale(): SupportedLocale {
  const { i18n } = useTranslation();
  const raw = (i18n.language || "en").toLowerCase();
  const short = raw.split(/[-_]/)[0];
  return (SUPPORTED as readonly string[]).includes(short)
    ? (short as SupportedLocale)
    : "en";
}
