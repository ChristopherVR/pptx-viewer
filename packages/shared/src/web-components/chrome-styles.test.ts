import { describe, expect, it } from 'vitest';

import { MOBILE_BAR_STYLES, MOBILE_TOOLBAR_STYLES } from './mobile-bar-styles';

// The read-only banner, Paste Options, compatibility toasts and dialog footer moved to ooxml-ui
// (`office-ui-*`); its own tests cover their touch, forced-colours and token rules.
/** The phone bars are always at least 44px: they only exist for touch. */
const ALWAYS_LARGE = { 'mobile bar': MOBILE_BAR_STYLES, 'mobile toolbar': MOBILE_TOOLBAR_STYLES };
const STYLES = { ...ALWAYS_LARGE };

describe('chrome control styles', () => {
	it.each(Object.entries(ALWAYS_LARGE))('%s keeps every target at least 44px', (_name, css) => {
		expect(css).toMatch(/min-height: (44|56)px/u);
	});

	it.each(Object.entries(STYLES))('%s has forced-colors and visible focus rules', (_name, css) => {
		expect(css).toContain('@media (forced-colors: active)');
		expect(css).toContain(':focus-visible');
	});

	it.each(Object.entries(STYLES))(
		'%s takes its colours from the shared theme tokens',
		(_name, css) => {
			expect(css).toMatch(/var\(--pptx-/u);
		},
	);
});
