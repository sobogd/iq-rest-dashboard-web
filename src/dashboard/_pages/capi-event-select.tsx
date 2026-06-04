import { CAPI_EVENTS } from "./capi-shared";

/** Event names not yet successfully sent for this click. */
export function availableEvents(sentNames: string[]): string[] {
  return CAPI_EVENTS.filter((e) => !sentNames.includes(e.name)).map((e) => e.name);
}
