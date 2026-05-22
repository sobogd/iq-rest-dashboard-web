"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./ui";
import { inputClass } from "./tokens";
import type { Discount } from "./types";

// Discount picker shared by the order-level "Add discount" menu and the
// per-item "Add discount" menu. Two types — percent and fixed — with an
// optional reason for analytics. Save replaces the existing discount;
// Remove clears it. Server clamps + rounds + validates on patch.

interface DiscountModalProps {
  open: boolean;
  initial: Discount | null;
  // Optional copy override — the menu provides "order" / "item" label.
  title?: string;
  subtitle?: string;
  currencySymbol: string;
  onClose: () => void;
  onSave: (next: Discount | null) => void | Promise<void>;
}

export function DiscountModal({
  open,
  initial,
  title,
  subtitle,
  currencySymbol,
  onClose,
  onSave,
}: DiscountModalProps) {
  const t = useTranslations("dashboard.orders");
  const [type, setType] = useState<Discount["type"]>("percent");
  const [value, setValue] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? "percent");
    setValue(initial?.value != null ? String(initial.value) : "");
    setReason(initial?.reason ?? "");
    setSaving(false);
  }, [open, initial]);

  const numericValue = Number(value);
  const valid =
    Number.isFinite(numericValue) &&
    numericValue > 0 &&
    (type === "percent" ? numericValue <= 100 : true);

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const next: Discount = {
        type,
        value: numericValue,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={title || t("discountTitle", { defaultValue: "Discount" })}
      subtitle={subtitle || t("discountSubtitle", { defaultValue: "Apply a discount to the price." })}
      size="sm"
      closeOnBackdrop={!saving}
      footer={
        <div className="flex items-center justify-between gap-2">
          {initial ? (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={saving}
              className="h-8 px-3 text-xs font-medium text-red-600 transition-colors disabled:opacity-50"
            >
              {t("discountRemove", { defaultValue: "Remove" })}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!valid || saving}
            className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors disabled:opacity-50"
          >
            {t("discountSave", { defaultValue: "Save" })}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2.5">
            {t("discountTypeLabel", { defaultValue: "Type" })}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("percent")}
              className={
                "h-10 rounded-lg text-sm font-medium transition-colors " +
                (type === "percent"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {t("discountTypePercent", { defaultValue: "Percent" })} (%)
            </button>
            <button
              type="button"
              onClick={() => setType("fixed")}
              className={
                "h-10 rounded-lg text-sm font-medium transition-colors " +
                (type === "fixed"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {t("discountTypeFixed", { defaultValue: "Fixed" })} ({currencySymbol})
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="discount-value" className="block text-sm font-medium text-foreground mb-2.5">
            {t("discountValueLabel", { defaultValue: "Value" })}
          </label>
          <input
            id="discount-value"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max={type === "percent" ? 100 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
            autoFocus
            placeholder={type === "percent" ? "10" : "5.00"}
          />
        </div>
        <div>
          <label htmlFor="discount-reason" className="block text-sm font-medium text-foreground mb-2.5">
            {t("discountReasonLabel", { defaultValue: "Reason (optional)" })}
          </label>
          <input
            id="discount-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("discountReasonPlaceholder", { defaultValue: "e.g. Loyal customer" })}
            className={inputClass}
          />
        </div>
      </div>
    </Modal>
  );
}
