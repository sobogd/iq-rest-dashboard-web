"use client";

import { CAPI_EVENTS } from "./capi-shared";

/** Event names not yet successfully sent for this click. */
export function availableEvents(sentNames: string[]): string[] {
  return CAPI_EVENTS.filter((e) => !sentNames.includes(e.name)).map((e) => e.name);
}

/** Selectable chips for the Meta CAPI event type. Only `events` are shown;
 *  the selected one is highlighted. */
export function CapiEventChips({
  events,
  value,
  onChange,
}: {
  events: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {events.map((name) => {
        const sel = name === value;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={
              "text-xs font-medium rounded-full px-3 py-1.5 border transition-colors " +
              (sel
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-foreground border-transparent hover:bg-muted")
            }
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
