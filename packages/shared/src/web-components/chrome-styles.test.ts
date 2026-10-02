import { describe, expect, it } from 'vitest';

import { COMPAT_TOASTS_STYLES } from './compat-toasts-styles';
import { DIALOG_FOOTER_STYLES } from './dialog-footer-styles';
import { MOBILE_BAR_STYLES, MOBILE_TOOLBAR_STYLES } from './mobile-bar-styles';
import { PASTE_OPTIONS_STYLES } from './paste-options-styles';
import { READ_ONLY_BANNER_STYLES } from './read-only-banner-styles';

const GROWING = {
	'read-only banner': READ_ONLY_BANNER_STYLES,
	'paste options': PASTE_OPTIONS_STYLES,
	'compat toasts': COMPAT_TOASTS_STYLES,
	'dialog footer': DIALOG_FOOTER_STYLES,
};
/** The phone bars are always at least 44px: they only exist for touch. */
const ALWAYS_LARGE = { 'mobile bar': MOBILE_BAR_STYLES, 'mobile toolbar': MOBILE_TOOLBAR_STYLES };
const STYLES = { ...GROWING, ...ALWAYS_LARGE };

describe('chrome control styles', () => {
	it.each(Object.entries(GROWING))(
		'%s grows its targets to 44px on coarse pointers',
		(_name, css) => {
			expect(css).toMatch(/@media \(pointer: coarse\)[^}]*min-height: 44px/u);
		},
	);

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
