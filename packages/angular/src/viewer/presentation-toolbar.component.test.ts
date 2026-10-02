/**
 * presentation-toolbar.component.test.ts: guards for the slide-show toolbar.
 *
 * The toolbar is the shared `pptx-ui-present-toolbar` element (its inventory,
 * names, palettes and gating are tested in `pptx-viewer-shared`); this file drives
 * the Angular adapter through TestBed and keeps the pure behaviour the adapter
 * delegates to (auto-hide, the Blackboard transition) plus the overlay chrome
 * guards, which read the overlay's authored source because it has no TestBed.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import {
	AUTO_HIDE_DELAY_MS,
	PRESENT_TOOLBAR_CLASSES,
	PRESENT_TOOLBAR_ORDER,
} from '../internal/shared';
import type { PresentationBlackout, PresentationPointerTool } from '../internal/shared';
import { componentSource } from './component-source.test-support';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import { presentationStageStyle } from './presentation-overlay-helpers';
import { PresentToolbarAutoHide, runBlackboardToggle } from './presentation-toolbar-view';
import { PresentationToolbarComponent } from './presentation-toolbar.component';
import { PresenterWindowService } from './presenter-window.service';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

const here = dirname(fileURLToPath(import.meta.url));
const overlaySource = componentSource(here, 'presentation-overlay.component.ts');

function open(inputs: Record<string, unknown> = {}) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [PresentationToolbarComponent],
		providers: [
			provideTranslateService({ fallbackLang: 'en' }),
			PresentationAnnotationsService,
			PresenterWindowService,
		],
	});
	// The Vitest JIT build does not wire signal inputs, so declare them and hand each
	// field a plain signal.
	const values = { currentSlideIndex: 1, totalSlides: 5, ...inputs };
	TestBed.overrideComponent(PresentationToolbarComponent, {
		add: { inputs: Object.keys(values) },
	});
	const fixture = TestBed.createComponent(PresentationToolbarComponent);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	const host = (fixture.nativeElement as HTMLElement).querySelector('pptx-ui-present-toolbar')!;
	const control = (id: string) =>
		host.shadowRoot!.querySelector<HTMLButtonElement>(`[data-pptx-present-control="${id}"]`);
	return {
		fixture,
		host,
		control,
		annotations: TestBed.inject(PresentationAnnotationsService),
	};
}

describe('show toolbar adapter', () => {
	it('renders the shared inventory as the toolbar landmark with the wrapper token', () => {
		const { fixture, host } = open();
		const ids = [...host.shadowRoot!.querySelectorAll('[data-pptx-present-control]')].map(
			(node) => (node as HTMLElement).dataset['pptxPresentControl'],
		);
		expect(ids).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
		expect(host.getAttribute('role')).toBe('toolbar');
		expect(host.getAttribute('aria-label')).toBe('Presentation toolbar');
		expect((fixture.nativeElement as HTMLElement).className).toContain(
			PRESENT_TOOLBAR_CLASSES.wrapper.split(' ')[0],
		);
	});

	it('maps the position inputs onto the counter and the navigation gating', () => {
		const middle = open({ currentSlideIndex: 1, totalSlides: 5 });
		expect(middle.control('counter')?.textContent).toBe('2 / 5');
		expect(middle.control('previous')?.disabled).toBeFalsy();
		const first = open({ currentSlideIndex: 0, totalSlides: 3 });
		expect(first.control('previous')?.disabled).toBeTruthy();
		const last = open({ currentSlideIndex: 2, totalSlides: 3 });
		expect(last.control('next')?.disabled).toBeTruthy();
	});

	it('routes navigation, presenter view and end to the outputs', () => {
		const { fixture, control } = open();
		const seen: string[] = [];
		fixture.componentInstance.move.subscribe((direction) => seen.push(`move:${direction}`));
		fixture.componentInstance.presenterViewToggle.subscribe(() => seen.push('presenter-view'));
		fixture.componentInstance.endPresentation.subscribe(() => seen.push('end'));
		for (const id of ['previous', 'next', 'presenter-view', 'end']) {
			control(id)?.click();
		}
		expect(seen).toStrictEqual(['move:-1', 'move:1', 'presenter-view', 'end']);
	});

	it('arms tools and picks swatches through the annotation service', () => {
		const { control, annotations, host } = open();
		control('laser')?.click();
		expect(annotations.tool()).toBe('laser');
		control('pen-color')?.click();
		host
			.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Pen colour #0000ff"]')
			?.click();
		expect(annotations.penColor()).toBe('#0000ff');
		expect(annotations.tool()).toBe('pen');
	});

	it('reflects the presenter-view state as pressed', () => {
		expect(
			open({ presenterMode: true }).control('presenter-view')?.getAttribute('aria-pressed'),
		).toBe('true');
	});
});

describe('show toolbar auto-hide', () => {
	it('starts hidden, shows on movement and fades after the shared delay', () => {
		vi.useFakeTimers();
		const seen: boolean[] = [];
		const autoHide = new PresentToolbarAutoHide((visible) => seen.push(visible));

		autoHide.poke();
		expect(seen).toStrictEqual([true]);

		vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 1);
		expect(seen).toStrictEqual([true]);

		vi.advanceTimersByTime(1);
		expect(seen).toStrictEqual([true, false]);

		autoHide.dispose();
		vi.useRealTimers();
	});

	it('restarts the countdown on every move, so a moving pointer never loses the bar', () => {
		vi.useFakeTimers();
		const seen: boolean[] = [];
		const autoHide = new PresentToolbarAutoHide((visible) => seen.push(visible));

		for (let i = 0; i < 5; i++) {
			autoHide.poke();
			vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 100);
		}
		expect(seen.every((visible) => visible)).toBeTruthy();

		vi.advanceTimersByTime(100);
		expect(seen.at(-1)).toBeFalsy();

		autoHide.dispose();
		vi.useRealTimers();
	});

	it('keeps the bar up while the pointer rests on it', () => {
		vi.useFakeTimers();
		const seen: boolean[] = [];
		const autoHide = new PresentToolbarAutoHide((visible) => seen.push(visible));

		autoHide.poke();
		autoHide.enter();
		vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 3);
		expect(seen).not.toContain(false);

		autoHide.leave();
		vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
		expect(seen.at(-1)).toBeFalsy();

		autoHide.dispose();
		vi.useRealTimers();
	});

	it('drops its pending timer on teardown', () => {
		vi.useFakeTimers();
		const seen: boolean[] = [];
		const autoHide = new PresentToolbarAutoHide((visible) => seen.push(visible));

		autoHide.poke();
		autoHide.dispose();
		vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2);

		expect(seen).toStrictEqual([true]);
		vi.useRealTimers();
	});
});

describe('blackboard toggle wiring', () => {
	/** Drive one press and capture what reached the two services. */
	function press(
		blackout: PresentationBlackout,
		tool: PresentationPointerTool,
	): { blackouts: PresentationBlackout[]; tools: PresentationPointerTool[] } {
		const blackouts: PresentationBlackout[] = [];
		const tools: PresentationPointerTool[] = [];
		runBlackboardToggle({
			blackout,
			tool,
			setBlackout: (value) => blackouts.push(value),
			setTool: (value) => tools.push(value),
		});
		return { blackouts, tools };
	}

	it('arms the black screen and the pen together from an idle show', () => {
		expect(press('none', 'none')).toStrictEqual({ blackouts: ['black'], tools: ['pen'] });
	});

	it('completes a partial state (blackout up, eraser armed) instead of tearing it down', () => {
		expect(press('black', 'eraser')).toStrictEqual({ blackouts: ['black'], tools: ['pen'] });
	});

	it('never calls the toggling setTool with an already-armed pen (which would disarm it)', () => {
		// setTool has PowerPoint toggle semantics: setTool('pen') while the pen is
		// armed would disarm it, so the helper must skip the call entirely.
		expect(press('none', 'pen')).toStrictEqual({ blackouts: ['black'], tools: [] });
	});

	it('disarms both from the active blackboard state', () => {
		expect(press('black', 'pen')).toStrictEqual({ blackouts: ['none'], tools: ['none'] });
	});
});

describe('blackboard layering (ink above the blackout sheet)', () => {
	it('stamps the e2e contract attributes on the overlay and the blank', () => {
		expect(overlaySource).toContain('data-pptx-annotation-overlay');
		expect(overlaySource).toContain('data-pptx-blackout');
	});

	it('binds the annotation overlay z-index to the shared blackboard decision', () => {
		expect(overlaySource).toContain('[style.z-index]="annotationOverlayZ()"');
		expect(overlaySource).toContain('annotationOverlayZIndex(');
	});

	it('keeps the blackout sheet decorative so a blanked show still advances', () => {
		// PowerPoint advances on a click anywhere on a blanked screen, and the ink
		// overlay is raised above this sheet while blanked precisely so strokes
		// land on it. A sheet that accepted pointer input would swallow both.
		const rule = /\.presenter-blank\s*\{(?<body>[^}]*)\}/u.exec(overlaySource);
		expect(rule?.groups?.['body']).toMatch(/pointer-events:\s*none/u);
	});

	it('centres the stage numerically, never with a transform (a stacking-context trap)', () => {
		// A transform on the stage container makes it a stacking context, which
		// pins every z-index inside it BELOW the sibling z-75 blackout sheet: the
		// exact bug that painted blackboard ink invisibly under the black screen.
		// (The quoted form matches only a TS style record; the laser dot's CSS
		// transform is unrelated and stays.)
		expect(overlaySource).not.toContain("transform: 'translate(-50%, -50%)'");
		expect(overlaySource).toContain('presentationStageStyle(');

		const style = presentationStageStyle({ width: 1280, height: 720 }, 0.5, 1000, 800);
		expect(style['transform']).toBeUndefined();
		expect(style['left']).toBe('180px');
		expect(style['top']).toBe('220px');
		expect(style['width']).toBe('640px');
		expect(style['height']).toBe('360px');
	});
});

describe('slide-show overlay chrome', () => {
	it('hosts the toolbar instead of the old bottom-left annotation strip', () => {
		expect(overlaySource).toContain('<pptx-presentation-toolbar');
		expect(overlaySource).not.toContain('pptx-ng-presentation-tools');
	});

	it('has dropped the captions button React never had', () => {
		expect(overlaySource).not.toContain('pptx.presentation.liveCaptions');
		// The subtitle bar itself and its host input stay.
		expect(overlaySource).toContain('<pptx-presentation-subtitle-bar');
	});

	it('shows the close button, edge arrows and counter pill on touch devices only', () => {
		const gate = /@media not all and \(any-pointer: coarse\) \{(?<body>[^}]*)\}/u.exec(
			overlaySource,
		);
		expect(gate, 'coarse-pointer gate is missing').not.toBeNull();
		const body = gate?.groups?.['body'] ?? '';
		expect(body).toContain('.pptx-ng-presentation-close');
		expect(body).toContain('.pptx-ng-presentation-nav');
		expect(body).toContain('.pptx-ng-presentation-counter');
	});
});
