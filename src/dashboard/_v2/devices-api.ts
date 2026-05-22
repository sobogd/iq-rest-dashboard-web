// Device-management API client. Admin-side (cookie-authed) endpoints for
// listing, creating, regenerating codes, revoking, and deleting paired
// devices.

import { apiUrl } from "@/lib/api";
import { activeRestaurantHeader } from "@/lib/active-restaurant";

export type DeviceType = "KITCHEN" | "WAITER";
export type DeviceStatus = "ACTIVE" | "REVOKED";

export interface ApiDevice {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  restaurantId: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  pendingCode: { code: string; expiresAt: string } | null;
}

function devFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  for (const [k, v] of Object.entries(activeRestaurantHeader())) headers.set(k, v);
  return fetch(apiUrl(path), { credentials: "include", ...init, headers });
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && typeof j === "object" && "message" in j) msg = String((j as { message: unknown }).message);
    } catch {
      // ignore
    }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export async function fetchDevices(): Promise<ApiDevice[]> {
  return unwrap<ApiDevice[]>(await devFetch("/devices"));
}

export async function createDevice(input: {
  name: string;
  type: DeviceType;
  restaurantId?: string;
}): Promise<ApiDevice> {
  return unwrap<ApiDevice>(
    await devFetch("/devices", { method: "POST", body: JSON.stringify(input) }),
  );
}

export async function regeneratePairingCode(
  deviceId: string,
): Promise<{ code: string; expiresAt: string }> {
  return unwrap(
    await devFetch(`/devices/${encodeURIComponent(deviceId)}/regenerate-code`, { method: "POST" }),
  );
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await unwrap(
    await devFetch(`/devices/${encodeURIComponent(deviceId)}/revoke`, { method: "POST" }),
  );
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const res = await devFetch(`/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`HTTP ${res.status}`);
  }
}
