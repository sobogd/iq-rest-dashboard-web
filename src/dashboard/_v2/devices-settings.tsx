"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChefHatIcon, CopyIcon, PlusIcon, TrashIcon } from "./icons";
import { ConfirmDialog, Modal, PageHeader, Select } from "./ui";
import { inputClass } from "./tokens";
import {
  createDevice,
  deleteDevice,
  fetchDevices,
  regeneratePairingCode,
  revokeDevice,
  type ApiDevice,
  type DeviceType,
} from "./devices-api";
import { useRestaurantsOrNull } from "./restaurants-context";

interface DevicesSettingsPageProps {
  onBack: () => void;
}

export function DevicesSettingsPage({ onBack }: DevicesSettingsPageProps) {
  const t = useTranslations("dashboard.devices");
  const qc = useQueryClient();
  const restaurants = useRestaurantsOrNull();

  const devicesQuery = useQuery({
    queryKey: ["devices"],
    queryFn: fetchDevices,
    refetchInterval: 15_000,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiDevice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ApiDevice | null>(null);
  const [codeFor, setCodeFor] = useState<ApiDevice | null>(null);

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["devices"] }), [qc]);

  const restaurantOptions = useMemo(() => {
    if (!restaurants?.list?.length) return [];
    return restaurants.list.map((r) => ({ value: r.id, label: r.title }));
  }, [restaurants]);

  // Close the code modal if the device behind it disappears or gets revoked.
  useEffect(() => {
    if (!codeFor) return;
    const fresh = devicesQuery.data?.find((d) => d.id === codeFor.id);
    if (!fresh || fresh.status === "REVOKED") {
      setCodeFor(null);
    } else if (fresh.pendingCode?.code && fresh.pendingCode.code !== codeFor.pendingCode?.code) {
      setCodeFor(fresh);
    }
  }, [devicesQuery.data, codeFor]);

  async function handleRevoke(d: ApiDevice) {
    try {
      await revokeDevice(d.id);
      toast.success(t("toastRevoked"));
      refresh();
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setConfirmRevoke(null);
    }
  }

  async function handleDelete(d: ApiDevice) {
    try {
      await deleteDevice(d.id);
      toast.success(t("toastDeleted"));
      refresh();
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleRegenerate(d: ApiDevice) {
    try {
      const code = await regeneratePairingCode(d.id);
      toast.success(t("toastCodeGenerated"));
      refresh();
      setCodeFor({ ...d, pendingCode: code });
    } catch {
      toast.error(t("toastCodeFailed"));
    }
  }

  return (
    <div className="max-w-5xl mx-auto md:px-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            type="button"
            onClick={onBack}
            className="h-8 px-3 text-xs font-medium text-foreground bg-secondary rounded-md"
          >
            {t("back")}
          </button>
        }
      />

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg"
        >
          <PlusIcon size={14} />
          {t("addDevice")}
        </button>
      </div>

      <DevicesList
        items={devicesQuery.data ?? []}
        loading={devicesQuery.isLoading}
        onRevoke={(d) => setConfirmRevoke(d)}
        onDelete={(d) => setConfirmDelete(d)}
        onShowCode={(d) => setCodeFor(d)}
        onRegenerate={handleRegenerate}
      />

      <AddDeviceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        restaurants={restaurantOptions}
        onCreated={(d) => {
          setAddOpen(false);
          refresh();
          setCodeFor(d);
        }}
      />

      <PairingCodeModal device={codeFor} onClose={() => setCodeFor(null)} onRegenerate={handleRegenerate} />

      <ConfirmDialog
        open={!!confirmRevoke}
        title={t("revokeTitle")}
        message={confirmRevoke ? t("revokeMessage", { name: confirmRevoke.name }) : ""}
        confirmLabel={t("revoke")}
        onConfirm={() => confirmRevoke && void handleRevoke(confirmRevoke)}
        onCancel={() => setConfirmRevoke(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("deleteTitle")}
        message={confirmDelete ? t("deleteMessage", { name: confirmDelete.name }) : ""}
        confirmLabel={t("delete")}
        onConfirm={() => confirmDelete && void handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function DevicesList({
  items,
  loading,
  onRevoke,
  onDelete,
  onShowCode,
  onRegenerate,
}: {
  items: ApiDevice[];
  loading: boolean;
  onRevoke: (d: ApiDevice) => void;
  onDelete: (d: ApiDevice) => void;
  onShowCode: (d: ApiDevice) => void;
  onRegenerate: (d: ApiDevice) => void;
}) {
  const t = useTranslations("dashboard.devices");
  if (loading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">{t("loading")}</div>;
  }
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((d) => (
        <DeviceRow
          key={d.id}
          device={d}
          onRevoke={() => onRevoke(d)}
          onDelete={() => onDelete(d)}
          onShowCode={() => onShowCode(d)}
          onRegenerate={() => onRegenerate(d)}
        />
      ))}
    </div>
  );
}

function DeviceRow({
  device,
  onRevoke,
  onDelete,
  onShowCode,
  onRegenerate,
}: {
  device: ApiDevice;
  onRevoke: () => void;
  onDelete: () => void;
  onShowCode: () => void;
  onRegenerate: () => void;
}) {
  const t = useTranslations("dashboard.devices");
  const isActive = device.status === "ACTIVE";
  const pending = device.pendingCode;
  const online = useMemo(() => {
    if (!device.lastSeenAt) return false;
    return Date.now() - new Date(device.lastSeenAt).getTime() < 60_000;
  }, [device.lastSeenAt]);

  const status = !isActive
    ? t("statusRevoked")
    : !device.pairedAt
      ? t("statusUnpaired")
      : online
        ? t("statusOnline")
        : t("statusOffline");

  const dotCls = !isActive
    ? "bg-red-500"
    : !device.pairedAt
      ? "bg-amber-500"
      : online
        ? "bg-emerald-500"
        : "bg-muted-foreground";

  return (
    <div className="p-4 bg-card border border-border rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ChefHatIcon size={16} className="text-muted-foreground shrink-0" />
            <div className="text-sm font-medium text-foreground truncate">{device.name}</div>
          </div>
          <div className="text-xs text-muted-foreground leading-snug mt-1 flex items-center gap-1.5">
            <span className={"w-1.5 h-1.5 rounded-full " + dotCls} />
            <span>{status}</span>
            <span>·</span>
            <span>{t(`type.${device.type}`)}</span>
            {device.lastSeenAt ? (
              <>
                <span>·</span>
                <span>{t("lastSeen", { at: new Date(device.lastSeenAt).toLocaleString() })}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {isActive && pending ? (
            <button
              type="button"
              onClick={onShowCode}
              className="h-8 px-3 text-xs font-medium text-foreground bg-secondary rounded-md"
            >
              {t("showCode")}
            </button>
          ) : null}
          {isActive && !pending ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="h-8 px-3 text-xs font-medium text-foreground bg-secondary rounded-md"
            >
              {t("generateCode")}
            </button>
          ) : null}
          {isActive ? (
            <button
              type="button"
              onClick={onRevoke}
              className="h-8 px-3 text-xs font-medium text-red-600 bg-secondary rounded-md"
            >
              {t("revoke")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              className="h-8 w-8 inline-flex items-center justify-center text-red-600 bg-secondary rounded-md"
              title={t("delete")}
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddDeviceModal({
  open,
  onClose,
  restaurants,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  restaurants: { value: string; label: string }[];
  onCreated: (device: ApiDevice) => void;
}) {
  const t = useTranslations("dashboard.devices");
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("KITCHEN");
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setType("KITCHEN");
      setRestaurantId(restaurants[0]?.value ?? "");
    }
  }, [open, restaurants]);

  async function handleCreate() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const d = await createDevice({
        name: name.trim(),
        type,
        ...(restaurantId ? { restaurantId } : {}),
      });
      onCreated(d);
    } catch (e) {
      const msg = (e as Error & { message?: string }).message || t("createFailed");
      toast.error(
        msg === "devices_require_paid_plan" ? t("requiresPaid") : t("createFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={t("addDevice")}
      size="sm"
      closeOnBackdrop={!saving}
      footer={
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || !name.trim()}
            className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg disabled:opacity-60"
          >
            {saving ? t("creating") : t("generateCode")}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("nameLabel")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("typeLabel")}</label>
          <Select
            value={type}
            onChange={(v) => setType(v)}
            options={[
              { value: "KITCHEN", label: t("type.KITCHEN") },
              { value: "WAITER", label: t("type.WAITER") },
            ]}
          />
        </div>
        {restaurants.length > 1 ? (
          <div>
            <label className="text-xs text-muted-foreground">{t("restaurantLabel")}</label>
            <Select
              value={restaurantId}
              onChange={(v) => setRestaurantId(v)}
              options={restaurants}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function PairingCodeModal({
  device,
  onClose,
  onRegenerate,
}: {
  device: ApiDevice | null;
  onClose: () => void;
  onRegenerate: (d: ApiDevice) => void;
}) {
  const t = useTranslations("dashboard.devices");
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!device?.pendingCode) {
      setRemaining(0);
      return;
    }
    const expiresAt = new Date(device.pendingCode.expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [device?.pendingCode]);

  if (!device || !device.pendingCode) return null;

  const code = device.pendingCode.code;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("codeCopied"));
    } catch {
      // ignore
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={t("codeTitle", { name: device.name })} size="sm">
      <div className="space-y-4 text-center">
        <div className="text-[44px] tracking-[0.4em] font-medium text-foreground select-all pl-[0.4em]">
          {code}
        </div>
        <div className="text-xs text-muted-foreground">
          {remaining > 0 ? t("expiresIn", { time: `${mm}:${ss}` }) : t("expired")}
        </div>
        <div className="text-[13px] text-muted-foreground leading-snug">
          {t("codeInstructions", { type: t(`type.${device.type}`).toLowerCase() })}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-foreground bg-secondary rounded-md"
          >
            <CopyIcon size={14} /> {t("copy")}
          </button>
          <button
            type="button"
            onClick={() => onRegenerate(device)}
            className="h-8 px-3 text-xs font-medium text-foreground bg-secondary rounded-md"
          >
            {t("regenerateCode")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
