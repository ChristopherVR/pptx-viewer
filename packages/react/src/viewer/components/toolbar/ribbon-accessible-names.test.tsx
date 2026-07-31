import { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
/**
 * Ribbon controls that are addressable by an accessible NAME.
 *
 * A ribbon button whose only text is the value it currently holds ("Segoe UI",
 * "24") announces the state of the deck rather than the control it is, so a
 * screen reader user, and every spec that addresses controls by role+name,
 * cannot find it. The same goes for a bare number input whose caption is a
 * plain <span> rather than a <label>. These three had that defect, and they are
 * the sort that comes back the moment someone reformats the markup, so they get
 * their own file rather than a line inside `Toolbar.test.tsx`.
 *
 * The i18n mock falls back the way the demos' i18next instance does
 * (`parseMissingKeyHandler: keyToLabel`), so a key with no dictionary entry
 * renders the label a real browser would show.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const entry = translationsEn[key];
			if (entry === undefined) {
				return keyToLabel(key);
			}
			return opts
				? entry.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: entry;
		},
	}),
}));

const { HomeSection } = await import('./HomeSection');
const { AnimationsSection } = await import('./AnimationsSection');
const { HelpSection } = await import('./HelpSection');

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

describe('home tab font controls', () => {
	const html = render(
		React.createElement(HomeSection, {
			canEdit: true,
			clipboardPayload: null,
			onCopy: vi.fn<() => void>(),
			onCut: vi.fn<() => void>(),
			onPaste: vi.fn<() => void>(),
			layoutOptions: [],
			onInsertSlideFromLayout: vi.fn<() => void>(),
			selectedElement: null,
			onUpdateTextStyle: vi.fn<() => void>(),
		}),
	);

	it('names the font-family picker after the control, not its current value', () => {
		expect(html).toContain('aria-label="Font family"');
		// Still shows the value; it just no longer IS the name.
		expect(html).toContain('Segoe UI');
	});

	it('names the font-size picker after the control, not its current value', () => {
		expect(html).toContain('aria-label="Font size"');
		expect(html).toContain('>24</span>');
	});
});

describe('animations tab timing fields', () => {
	it('names the duration input, whose caption is a span rather than a label', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('aria-label="Duration"');
	});
});

describe('help tab', () => {
	it('offers Settings, which angular, vanilla and svelte already did', () => {
		const html = render(
			React.createElement(HelpSection, {
				onOpenSettings: vi.fn<() => void>(),
				onToggleShortcuts: vi.fn<() => void>(),
				onRunAccessibilityCheck: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('>Settings</button>');
		expect(html).toContain('>Keyboard Shortcuts</button>');
		expect(html).toContain('>Accessibility Check</button>');
	});
});
