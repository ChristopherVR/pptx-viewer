/**
 * Reading View, React binding.
 *
 * The navigation rules themselves are proved once in
 * `pptx-viewer-shared/render/reading-view`. What is worth proving here is the
 * glue that has historically rotted: that the ribbon control is actually LIVE
 * (it shipped disabled in all five bindings for a year), that the overlay
 * carries the neutral DOM contract `e2e/` addresses all five viewers through,
 * and that it is a windowed view rather than a second slide show.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { READING_VIEW_ATTR, READING_VIEW_COUNTER_ATTR } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ReadingViewOverlay } from './ReadingViewOverlay';
import { ViewSection } from './toolbar/ViewSection';
import type { ViewSectionProps } from './toolbar/ViewSection';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const render = (element: React.ReactElement): string => renderToStaticMarkup(element);

const slide = (id: string): PptxSlide =>
	({ id, elements: [], slideNumber: 1 }) as unknown as PptxSlide;

const DECK = [slide('s1'), slide('s2'), slide('s3')];

function overlay(activeSlideIndex = 0): string {
	return render(
		<ReadingViewOverlay
			slides={DECK}
			templateElements={[]}
			canvasSize={{ width: 960, height: 540 }}
			activeSlideIndex={activeSlideIndex}
			onExit={vi.fn()}
		/>,
	);
}

// ---------------------------------------------------------------------------
// Ribbon control
// ---------------------------------------------------------------------------

function viewProps(overrides: Partial<ViewSectionProps> = {}): ViewSectionProps {
	return {
		canEdit: true,
		editTemplateMode: false,
		onSetEditTemplateMode: vi.fn(),
		spellCheckEnabled: true,
		onSetSpellCheckEnabled: vi.fn(),
		showGrid: false,
		showRulers: false,
		showGuides: false,
		snapToGrid: false,
		snapToShape: false,
		onSetShowGrid: vi.fn(),
		onSetShowRulers: vi.fn(),
		onSetShowGuides: vi.fn(),
		onSetSnapToGrid: vi.fn(),
		onSetSnapToShape: vi.fn(),
		onAddGuide: vi.fn(),
		onEnterMasterView: vi.fn(),
		onOpenReadingView: vi.fn(),
		...overrides,
	};
}

describe('view tab Reading View control', () => {
	/**
	 * The regression this whole feature exists for: every binding rendered this
	 * button permanently `disabled`, so a reader who found it in the ribbon got
	 * nothing at all.
	 */
	it('is enabled rather than an inert placeholder', () => {
		const html = render(<ViewSection {...viewProps()} />);
		expect(html).toContain('title="Reading View"');
		expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*title="Reading View"/u);
	});
});

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

describe('reading view overlay', () => {
	it('exposes the neutral reading-view DOM contract', () => {
		const html = overlay();
		expect(html).toContain(READING_VIEW_ATTR);
		expect(html).toContain(READING_VIEW_COUNTER_ATTR);
		expect(html).toContain('aria-label="Reading View"');
	});

	it('shows the slide the editor was on, one-based', () => {
		expect(overlay(1)).toContain('2 / 3');
		expect(overlay(0)).toContain('1 / 3');
	});

	it('offers previous, next and a way back to Normal', () => {
		const html = overlay(1);
		expect(html).toContain('aria-label="Previous"');
		expect(html).toContain('aria-label="Next"');
		expect(html).toContain('aria-label="Normal view"');
	});

	it('disables previous on the first slide and leaves it live after that', () => {
		// `[^>]*` cannot cross a `>`, so each match is confined to one tag.
		expect(overlay(0)).toMatch(/aria-label="Previous"[^>]*disabled=""/u);
		expect(overlay(1)).not.toMatch(/aria-label="Previous"[^>]*disabled=""/u);
	});

	/**
	 * Reading View is the deck at full WINDOW size. If this ever starts asking
	 * for the Fullscreen API it has become a second, worse slide show.
	 */
	it('is a windowed overlay, not a fullscreen slide show', () => {
		const html = overlay();
		expect(html).toContain('fixed inset-0');
		// No slide-show chrome leaked in.
		expect(html).not.toContain('Presenter');
		expect(html).not.toContain('Laser');
	});

	it('renders nothing when the deck is empty', () => {
		const html = render(
			<ReadingViewOverlay
				slides={[]}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				activeSlideIndex={0}
				onExit={vi.fn()}
			/>,
		);
		expect(html).toBe('');
	});
});
