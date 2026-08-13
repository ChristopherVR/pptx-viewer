import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the Transitions ribbon tab.
 *
 * The defect these cover is not "a control is missing" (the inventory spec
 * already proves presence): it is that every control was `React.useState` and
 * nothing reached the deck. So these assert EFFECT, not presence.
 */
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { changeLanguage: vi.fn(), language: 'en' },
	}),
	// oxlint-disable-next-line no-explicit-any
	Trans: ({ children }: { children?: React.ReactNode }) => children,
	initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { TransitionsSection } = await import('./TransitionsSection');

function slideWith(transition?: PptxSlideTransition): PptxSlide {
	return { id: 's1', elements: [], transition } as unknown as PptxSlide;
}

function renderTab(overrides: Partial<Parameters<typeof TransitionsSection>[0]> = {}): {
	html: string;
	onTransitionChange: ReturnType<typeof vi.fn>;
} {
	const onTransitionChange = vi.fn<(updates: Partial<PptxSlideTransition>) => void>();
	const html = renderToStaticMarkup(
		React.createElement(TransitionsSection, {
			isInspectorPaneOpen: false,
			onToggleInspector: vi.fn<() => void>(),
			onTransitionChange,
			onApplyTransitionToAll: vi.fn<() => void>(),
			...overrides,
		}),
	);
	return { html, onTransitionChange };
}

describe('transitionsSection reads the active slide', () => {
	it('highlights the preset the slide actually carries', () => {
		const { html } = renderTab({ activeSlide: slideWith({ type: 'wipe', durationMs: 1500 }) });
		// The selected preset is the only one with the primary border classes.
		const wipeIndex = html.indexOf('pptx.ribbon.transition.wipe</button>');
		const wipeButton = html.slice(0, wipeIndex);
		expect(wipeButton.slice(wipeButton.lastIndexOf('<button'))).toContain('border-primary');
	});

	it('shows the slide duration rather than a hard-coded default', () => {
		const { html } = renderTab({ activeSlide: slideWith({ type: 'fade', durationMs: 1500 }) });
		expect(html).toContain('value="1.5"');
	});

	it('shows a stored timed advance in the After field', () => {
		const { html } = renderTab({
			activeSlide: slideWith({ type: 'fade', advanceAfterMs: 3000 }),
		});
		expect(html).toContain('value="00:03.00"');
	});

	it('disables the Sound select, which nothing can author', () => {
		const { html } = renderTab();
		expect(html).toMatch(/<select[^>]*disabled/);
	});
});

describe('the tab is reachable from a slide with no transition', () => {
	it('falls back to the empty draft instead of throwing', () => {
		const { html } = renderTab({ activeSlide: slideWith() });
		expect(html).toContain('value="0.7"');
		expect(html).toContain('value="00:00.00"');
	});
});
