"use client";

import { createContext, useContext, ReactNode } from "react";

export type Sub = {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  aiImagesUsed?: number;
  aiImagesLimit?: number | null;
} | null;

const SubContext = createContext<Sub>(null);

export function SubProvider({ sub, children }: { sub: Sub; children: ReactNode }) {
  return <SubContext.Provider value={sub}>{children}</SubContext.Provider>;
}

export function useSub(): Sub {
  return useContext(SubContext);
}

export type AiImageAccess =
  | { kind: "unlimited" }
  | { kind: "limited"; used: number; limit: number; remaining: number }
  | { kind: "exhausted"; used: number; limit: number };

export function useAiImageAccess(): AiImageAccess {
  const sub = useSub();
  const isPaid =
    !!sub && sub.subscriptionStatus === "ACTIVE" && !!sub.plan && sub.plan !== "FREE";
  if (isPaid) return { kind: "unlimited" };
  const used = sub?.aiImagesUsed ?? 0;
  const limit = sub?.aiImagesLimit ?? 5;
  const remaining = Math.max(0, limit - used);
  if (remaining === 0) return { kind: "exhausted", used, limit };
  return { kind: "limited", used, limit, remaining };
}
