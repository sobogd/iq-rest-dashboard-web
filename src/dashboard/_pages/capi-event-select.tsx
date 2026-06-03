"use client";

import { CAPI_EVENTS } from "./capi-shared";

/** Shared Meta CAPI event-type select. Already-sent events are disabled. */
export function CapiEventSelect({
  value,
  onChange,
  sentNames = [],
}: {
  value: string;
  onChange: (v: string) => void;
  sentNames?: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
    >
      {CAPI_EVENTS.map((e) => (
        <option key={e.name} value={e.name} disabled={sentNames.includes(e.name)}>
          {e.name}{sentNames.includes(e.name) ? " — already sent" : ""}
        </option>
      ))}
    </select>
  );
}
