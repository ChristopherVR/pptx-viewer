/**
 * Canonical control tokens: one place that owns the field, focus-ring, density
 * and checkbox treatments every shared primitive (`pptx-ui-search`,
 * `pptx-ui-select`, `pptx-ui-checkbox`) and the normalised native controls read.
 *
 * The values are defaults; a viewer root, the host application or a theme can override any
 * of them without touching a component. Colours alias the existing `--pptx-*`
 * theme variables, so light, dark and custom themes keep working.
 */
export const CONTROL_TOKENS = {
	// Field (search, select trigger, text inputs)
	'--pptx-field-border': 'var(--pptx-input, #374151)',
	'--pptx-field-border-focus': 'var(--pptx-ring, #6366f1)',
	'--pptx-field-bg': 'var(--pptx-card, #111827)',
	'--pptx-field-fg': 'var(--pptx-card-foreground, #f3f4f6)',
	'--pptx-field-placeholder': 'var(--pptx-muted-foreground, #9ca3af)',
	'--pptx-field-radius': '5px',
	'--pptx-field-height': '28px',
	'--pptx-field-height-lg': '40px',
	'--pptx-field-padding-x': '7px',
	// Focus ring (keyboard focus on every control)
	'--pptx-focus-ring-color': 'var(--pptx-ring, #6366f1)',
	'--pptx-focus-ring-width': '2px',
	'--pptx-focus-ring-offset': '2px',
	// Density scale (spacing steps and row heights)
	'--pptx-space-1': '4px',
	'--pptx-space-2': '8px',
	'--pptx-space-3': '12px',
	'--pptx-space-4': '16px',
	'--pptx-row-height': '28px',
	'--pptx-row-height-nav': '40px',
	'--pptx-touch-target': '44px',
	// Checkbox / switch accent
	'--pptx-checkbox-size': '16px',
	'--pptx-checkbox-size-touch': '22px',
	'--pptx-checkbox-radius': '3px',
	'--pptx-checkbox-border': 'var(--pptx-border, #374151)',
	'--pptx-checkbox-bg': 'var(--pptx-background, #030712)',
	'--pptx-checkbox-accent': 'var(--pptx-primary, #6366f1)',
	'--pptx-checkbox-accent-fg': 'var(--pptx-primary-foreground, #fff)',
} as const;

export type ControlToken = keyof typeof CONTROL_TOKENS;

/**
 * `var()` reference for a token, with its canonical default as the fallback.
 *
 * Defaults are resolved where the token is read rather than declared on
 * `:root`: colour defaults alias the viewer's `--pptx-*` theme variables, which
 * are set on the viewer root and would not be visible from `:root`.
 */
export function tok(name: ControlToken): string {
	return `var(${name}, ${CONTROL_TOKENS[name]})`;
}

/** The focus ring every shared control draws for keyboard focus. */
export const FOCUS_RING = `outline: ${tok('--pptx-focus-ring-width')} solid ${tok('--pptx-focus-ring-color')};
	outline-offset: ${tok('--pptx-focus-ring-offset')};`;
