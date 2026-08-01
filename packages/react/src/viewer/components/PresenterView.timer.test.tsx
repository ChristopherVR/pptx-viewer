// @vitest-environment happy-dom
/**
 * The console's progress bar paces a talk in five-minute segments. React had
 * the segment length and the clamp inline, Vue re-derived them, Angular wrapped
 * them in a helper of its own and the other two bindings shipped no bar at all,
 * so the reading now comes from shared `presenterTimerProgress`. This pins the
 * wiring: the bar reports that function's numbers, and its tooltip is a
 * translated string rather than the English template that was hard-coded here.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { formatElapsed, presenterTimerProgress } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string | number>) => {
			const raw = translationsEn[key] ?? key;
			return options
				? raw.replaceAll(/\{\{(?<name>\w+)\}\}/gu, (_, name: string) => String(options[name] ?? ''))
				: raw;
		},
	}),
}));

// The console's panes render whole slides; the timer bar is what is under test.
vi.mock(import('./ScaledSlidePreview'), () => ({
	ScaledSlidePreview: () => <div data-slide-preview />,
}));

const { PresenterView } = await import('./PresenterView');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

const SLIDE = { id: 'a', slideNumber: 1, elements: [] } as unknown as PptxSlide;

function snapshot(elapsedMs: number): PresentationSnapshot {
	return { slideIndex: 0, buildStep: 0, sequence: 0, blackout: 'none', paused: false, elapsedMs };
}

function renderView(elapsedMs: number): void {
	act(() => {
		root.render(
			<PresenterView
				slides={[SLIDE]}
				currentSlideIndex={0}
				canvasSize={{ width: 960, height: 540 }}
				templateElements={[]}
				presentationStartTime={null}
				onMovePresentationSlide={() => undefined}
				onExit={() => undefined}
				snapshot={snapshot(elapsedMs)}
				onNavigateToSlide={() => undefined}
				onToggleTimer={() => undefined}
				onResetTimer={() => undefined}
				onStepZoom={() => undefined}
				onResetZoom={() => undefined}
				onSetBlackout={() => undefined}
				onUpdateSnapshot={() => undefined}
				onToggleSubtitles={() => undefined}
				onSwapDisplays={() => undefined}
			/>,
		);
	});
}

function progressBar(): HTMLElement | null {
	return container.querySelector<HTMLElement>('[role="progressbar"]');
}

describe('the presenter console timer bar', () => {
	it('reports the shared progress reading', () => {
		const elapsedMs = 7.5 * 60 * 1000;
		renderView(elapsedMs);
		const expected = presenterTimerProgress(elapsedMs);
		expect(expected.percent).toBe(50);
		expect(expected.segment).toBe(1);
		expect(progressBar()?.getAttribute('aria-valuenow')).toBe(String(Math.round(expected.percent)));
		expect(progressBar()?.querySelector<HTMLElement>('div')?.style.width).toBe(
			`${expected.percent}%`,
		);
	});

	it('restarts the fill on each new segment rather than pinning at 100', () => {
		renderView(5 * 60 * 1000);
		expect(progressBar()?.getAttribute('aria-valuenow')).toBe('0');
	});

	it('names the bar and its tooltip from the dictionary', () => {
		const elapsedMs = 7.5 * 60 * 1000;
		renderView(elapsedMs);
		expect(progressBar()?.getAttribute('aria-label')).toBe(
			translationsEn['pptx.presenter.timerProgress'],
		);
		expect(progressBar()?.getAttribute('title')).toBe(`${formatElapsed(elapsedMs)} (segment 2)`);
	});
});
