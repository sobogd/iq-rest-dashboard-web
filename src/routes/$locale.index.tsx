import { createFileRoute, redirect } from "@tanstack/react-router";
import { api } from "@/lib/api";

export const Route = createFileRoute("/$locale/")({
  beforeLoad: async ({ params }) => {
    const auth = await api<{ authenticated: boolean }>("/auth/check").catch(() => ({
      authenticated: false,
    }));
    throw redirect({
      to: auth.authenticated ? "/$locale/dashboard" : "/$locale/login",
      params: { locale: params.locale },
    });
  },
});
