import type React from 'react';
import { LuLayers, LuMessageSquare, LuSettings2 } from 'react-icons/lu';

import type { InspectorTab } from './inspector-pane-types';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

export const INSPECTOR_TABS: Array<{
	key: InspectorTab;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{ key: 'elements', label: 'Elements', icon: LuLayers },
	{ key: 'properties', label: 'Properties', icon: LuSettings2 },
	{ key: 'comments', label: 'Comments', icon: LuMessageSquare },
];

// ---------------------------------------------------------------------------
// Reusable CSS class-name tokens
// ---------------------------------------------------------------------------

export const HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';
export const CARD = 'rounded border border-border bg-card p-2 space-y-2';
// `max-md:min-h-[44px]!` (Tailwind's `md` breakpoint = 768px = `MOBILE_BREAKPOINT`
// in `pptx-viewer-shared`'s dense-panel responsive module) gives every field/
// button across the ~20 inspector sub-panels that reuse these two tokens a
// WCAG touch target below the mobile breakpoint from this one change, instead
// of each sub-panel wiring viewport width itself. A sub-panel with its OWN
// densely repeating grid (a data-entry table of cells, not a one-per-row
// field) should keep using its own un-widened cell-input token instead of
// this one - see `chart-panel-constants.ts`'s `CELL_INPUT` for the pattern.
export const INPUT =
	'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full max-md:min-h-[44px]!';
// `max-md:min-w-[44px]!` alongside the height: a single-letter label (Bold
// "B", Italic "I", Underline "U" in TableStyleEditorFields) otherwise clears
// the height floor but stays as narrow as its glyph, e.g. 24x44 - still a
// WCAG miss on its smaller side.
export const BTN =
	'rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors max-md:min-h-[44px]! max-md:min-w-[44px]!';

// ---------------------------------------------------------------------------
// Position / size field tuple
// ---------------------------------------------------------------------------

export const POS_FIELDS = [
	['X', 'x'],
	['Y', 'y'],
	['W', 'width'],
	['H', 'height'],
] as const;
