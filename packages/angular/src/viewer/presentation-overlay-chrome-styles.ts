/**
 * presentation-overlay-chrome-styles.ts: the fixed-position inline styles for
 * the slide-show overlay's own chrome (close button, edge navigation buttons,
 * slide counter).
 *
 * These are `[ngStyle]` records rather than CSS classes because they must beat
 * whatever the host page's stylesheet does to a `<button>` inside a fullscreen
 * overlay, and because the safe-area `env()` offsets are read straight back by
 * the mobile e2e specs. They are static data with no dependency on component
 * state, so they live here instead of taking up a third of
 * {@link PresentationOverlayComponent}.
 */

/** Inline style record as Angular's `[ngStyle]` consumes it. */
export type OverlayStyle = Record<string, string>;

/**
 * Always-visible close button, fixed at the top-right and offset by the device
 * safe-area insets so it clears notches / rounded corners. Sits on a higher
 * z-index than the stage so taps never fall through to tap-advance.
 */
export const OVERLAY_CLOSE_BUTTON_STYLE: OverlayStyle = {
	position: 'fixed',
	top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
	right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
	display: 'flex',
	'align-items': 'center',
	'justify-content': 'center',
	width: '44px',
	height: '44px',
	'min-width': '44px',
	'min-height': '44px',
	background: 'rgba(0,0,0,0.55)',
	border: 'none',
	'border-radius': '50%',
	color: '#fff',
	cursor: 'pointer',
	'font-size': '1.25rem',
	'line-height': '1',
	'pointer-events': 'auto',
	'z-index': '10002',
	'touch-action': 'manipulation',
};

/** Shared geometry for the left/right edge navigation buttons. */
const NAV_BUTTON_BASE: OverlayStyle = {
	position: 'fixed',
	top: '50%',
	transform: 'translateY(-50%)',
	display: 'flex',
	'align-items': 'center',
	'justify-content': 'center',
	width: '44px',
	height: '44px',
	'min-width': '44px',
	'min-height': '44px',
	background: 'rgba(0,0,0,0.45)',
	border: 'none',
	'border-radius': '50%',
	color: '#fff',
	cursor: 'pointer',
	'font-size': '1.75rem',
	'line-height': '1',
	'pointer-events': 'auto',
	'z-index': '10001',
	'touch-action': 'manipulation',
};

export const OVERLAY_PREV_BUTTON_STYLE: OverlayStyle = {
	...NAV_BUTTON_BASE,
	left: 'calc(env(safe-area-inset-left, 0px) + 0.5rem)',
};

export const OVERLAY_NEXT_BUTTON_STYLE: OverlayStyle = {
	...NAV_BUTTON_BASE,
	right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
};

export const OVERLAY_COUNTER_STYLE: OverlayStyle = {
	position: 'fixed',
	bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)',
	left: '50%',
	transform: 'translateX(-50%)',
	padding: '0.25rem 0.75rem',
	background: 'rgba(0,0,0,0.55)',
	'border-radius': '999px',
	color: '#fff',
	'font-family': 'system-ui, sans-serif',
	'font-size': '0.875rem',
	'line-height': '1.4',
	'pointer-events': 'none',
	'z-index': '10001',
};
