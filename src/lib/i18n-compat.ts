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

export function useLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language;
}
