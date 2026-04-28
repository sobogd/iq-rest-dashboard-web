import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/auth/auth-page";

export const Route = createFileRoute("/login")({
  component: AuthPage,
});
