import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
/**
 * Tests for TabRowActions: the Record + Share actions on the ribbon tab row.
 * Uses react-dom/server renderToStaticMarkup, matching the convention used
 * by Toolbar.test.tsx and StatusBar.test.tsx.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { TabRowActionsProps } from './TabRowActions';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const translations: Record<string, string> = {
				'pptx.titleBar.record': 'Record',
				'pptx.toolbar.share': 'Share',
			};
			const v = translations[key];
			if (typeof v === 'string') {
				return v;
			}
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

const { TabRowActions } = await import('./TabRowActions');

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

function createProps(overrides: Partial<TabRowActionsProps> = {}): TabRowActionsProps {
	return {
		onEnterRehearsalMode: vi.fn<() => void>(),
		onOpenShareDialog: vi.fn<() => void>(),
		onPackageForSharing: vi.fn<() => void>(),
		...overrides,
	};
}

describe('tabRowActions - default (backward compatible)', () => {
	it('renders both Record and Share when hiddenActions is omitted', () => {
		const html = render(React.createElement(TabRowActions, createProps()));
		expect(html).toContain('aria-label="Record"');
		expect(html).toContain('aria-label="Share"');
	});
});

describe('tabRowActions - hiddenActions', () => {
	it('omits the Share button when "share" is hidden', () => {
		const html = render(
			React.createElement(TabRowActions, createProps({ hiddenActions: ['share'] })),
		);
		expect(html).not.toContain('aria-label="Share"');
		expect(html).toContain('aria-label="Record"');
	});

	it('omits the Record button when "record" is hidden', () => {
		const html = render(
			React.createElement(TabRowActions, createProps({ hiddenActions: ['record'] })),
		);
		expect(html).not.toContain('aria-label="Record"');
		expect(html).toContain('aria-label="Share"');
	});

	it('omits both when both ids are hidden', () => {
		const html = render(
			React.createElement(TabRowActions, createProps({ hiddenActions: ['record', 'share'] })),
		);
		expect(html).not.toContain('aria-label="Record"');
		expect(html).not.toContain('aria-label="Share"');
	});
});
