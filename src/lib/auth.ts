import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface AuthState {
  authenticated: boolean;
  email?: string;
  userId?: string;
  companyId?: string;
}

export function useAuth() {
  return useQuery<AuthState>({
    queryKey: ["auth"],
    queryFn: () => api<AuthState>("/auth/check"),
    staleTime: 60_000,
  });
}

export function useSendOtp() {
  return useMutation({
    mutationFn: (vars: { email: string; locale?: string }) =>
      api<{ ok: boolean; isNewUser: boolean }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; code: string }) =>
      api<{ ok: boolean; onboardingStep: number; isNewUser: boolean }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth"] }),
  });
}
