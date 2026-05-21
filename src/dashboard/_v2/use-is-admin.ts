import { useQueryClient } from "@tanstack/react-query";
import { isAdminEmail } from "@/lib/admin";

interface AuthCheckShape {
  authenticated?: boolean;
  email?: string | null;
}

/** Reads the cached ["auth"] query (set by dashboard-host) and answers
 *  whether the current user is an admin per VITE_ADMIN_EMAIL_DOMAIN. */
export function useIsAdmin(): boolean {
  const qc = useQueryClient();
  const auth = qc.getQueryData<AuthCheckShape>(["auth"]);
  return isAdminEmail(auth?.email);
}
