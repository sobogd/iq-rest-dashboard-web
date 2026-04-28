/** next/link + next/navigation + @/i18n/routing facade over TanStack Router
 *  so dashboard source copied verbatim from soqrmenuweb compiles unchanged. */
import { Link as TanstackLink, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

interface LinkProps extends Omit<ComponentProps<"a">, "href"> {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
}

export function Link({ href, children, prefetch: _p, scroll: _s, replace, ...rest }: LinkProps) {
  // TanStack expects `to` typed against the route tree; we cast since we route by string.
  return (
    <TanstackLink to={href as never} replace={replace} {...rest}>
      {children}
    </TanstackLink>
  );
}

export default Link;

interface NextRouter {
  push: (href: string) => void;
  replace: (href: string) => void;
  refresh: () => void;
  back: () => void;
  forward: () => void;
  prefetch: (href: string) => void;
}

export function useRouter(): NextRouter {
  const navigate = useNavigate();
  return {
    push: (href: string) => void navigate({ to: href as never }),
    replace: (href: string) => void navigate({ to: href as never, replace: true }),
    refresh: () => {},
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    prefetch: () => {},
  };
}

export function usePathname(): string {
  const state = useRouterState({ select: (s) => s.location.pathname });
  return state || "/";
}

export function useSearchParams(): URLSearchParams {
  const search = useRouterState({ select: (s) => s.location.searchStr });
  return new URLSearchParams(search || "");
}

/** Server-side redirect from Next.js — in client SPA, hard-navigate. */
export function redirect(href: string): never {
  if (typeof window !== "undefined") window.location.assign(href);
  throw new Error("REDIRECT_" + href);
}

/** notFound facade — render a route's 404 boundary. We just throw. */
export function notFound(): never {
  throw new Error("NOT_FOUND");
}
