/**
 * Reusable inspector class-name tokens, mirroring React's
 * `inspector/inspector-pane-constants.ts` so the Vue no-selection inspector
 * renders the same card / heading / input / button chrome as React.
 */
export const HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';
export const CARD = 'rounded border border-border bg-card p-2 space-y-2';
export const INPUT = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full';
export const BTN = 'rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors';

/** The three inspector tabs, matching React's `InspectorTab`. */
export type InspectorTab = 'elements' | 'properties' | 'comments';
