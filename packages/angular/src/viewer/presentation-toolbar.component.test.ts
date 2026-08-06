/**
 * presentation-toolbar.component.test.ts: guards for the slide-show toolbar.
 *
 * This package has no TestBed (see `vitest.config.ts`), so the inventory guards
 * read the component's authored template as text via `componentSource`, the
 * same technique the element-renderer and context-menu contract specs use. That
 * is not a weaker assertion than rendering for what is being checked here: the
 * template is static markup, so "the 17 shared control ids appear once each, in
 * order, each naming itself from the shared i18n key" is fully decidable from
 * the source, and it is exactly the drift that let Angular ship a five-button
 * strip while React shipped sixteen slots.
 *
 * The behaviour that is NOT static (auto-hide, disabled predicates) is tested
 * directly against the pure module the component delegates to.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
	AUTO_HIDE_DELAY_MS,
	PRESENT_TOOLBAR_CLASSES,
	PRESENT_TOOLBAR_CONTROLS,
	PRESENT_TOOLBAR_ORDER,
} from '../internal/shared';
import type { PresentationBlackout, PresentationPointerTool } from '../internal/shared';
import { componentSource } from './component-source.test-support';
import { presentationStageStyle } from './presentation-overlay-helpers';
import {
	PRESENT_TOOLBAR_VIEW,
	PresentToolbarAutoHide,
	isAtFirstSlide,
	isAtLastSlide,
	presentToolbarClearClass,
	presentToolbarSwatchClass,
	presentToolbarToggleClass,
	runBlackboardToggle,
} from './presentation-toolbar-view';

const here = dirname(fileURLToPath(import.meta.url));
const source = componentSource(here, 'presentation-toolbar.component.ts');
const overlaySource = componentSource(here, 'presentation-overlay.component.ts');

/** The `data-pptx-present-control` values the template emits, in render order. */
function renderedControlIds(): string[] {
	const ids: string[] = [];
	const pattern = /data-pptx-present-control="(?<id>[a-z-]+)"/gu;
	let match = pattern.exec(source);
	while (match !== null) {
		ids.push(match[1] ?? '');
		match = pattern.exec(source);
	}
	return ids;
}

/** The template markup of the control with the given shared id. */
function controlMarkup(id: string): string {
	const start = source.indexOf(`data-pptx-present-control="${id}"`);
	expect(start, `control "${id}" is missing from the template`).toBeGreaterThan(-1);
	const end = source.indexOf('>', start);
	return source.slice(source.lastIndexOf('<', start), end);
}

describe('show toolbar inventory', () => {
	it('renders every shared control exactly once, in the shared order', () => {
		expect(renderedControlIds()).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
	});

	it('renders all seventeen slots, not the old five-button annotation strip', () => {
		expect(renderedControlIds()).toHaveLength(17);
	});

	it('slots the blackboard toggle between the eraser and clear, as shared orders it', () => {
		const ids = renderedControlIds();
		expect(ids.indexOf('blackboard')).toBe(ids.indexOf('eraser') + 1);
		expect(ids.indexOf('clear')).toBe(ids.indexOf('blackboard') + 1);
	});

	it('names each control from its shared i18n key, for the screen reader AND the tooltip', () => {
		for (const control of PRESENT_TOOLBAR_CONTROLS) {
			if (control.labelKey === undefined) {
				continue;
			}
			const markup = controlMarkup(control.id);
			expect(markup, `${control.id} aria-label`).toContain(
				`[attr.aria-label]="'${control.labelKey}' | translate"`,
			);
			expect(markup, `${control.id} title`).toContain(
				`[attr.title]="'${control.labelKey}' | translate"`,
			);
		}
	});

	it('leaves the counter and the dividers unnamed, as shared declares them', () => {
		for (const control of PRESENT_TOOLBAR_CONTROLS) {
			if (control.labelKey !== undefined) {
				continue;
			}
			expect(controlMarkup(control.id)).not.toContain('aria-label');
		}
	});

	it('labels each palette swatch with the interpolated shared colour key', () => {
		expect(source).toContain(
			"'pptx.presentationToolbar.penColorValue' | translate: { color: color }",
		);
		expect(source).toContain(
			"'pptx.presentationToolbar.highlighterColorValue' | translate: { color: color }",
		);
	});

	it('is a real toolbar with the shared accessible name', () => {
		expect(source).toContain('role="toolbar"');
		expect(source).toContain("'pptx.toolbar.presentationToolbarAria' | translate");
	});

	it('takes its geometry from the shared class tokens, never hand-written utilities', () => {
		expect(source).toContain('[class]="ui.container"');
		expect(PRESENT_TOOLBAR_VIEW.container).toBe(PRESENT_TOOLBAR_CLASSES.container);
		expect(PRESENT_TOOLBAR_VIEW.wrapper).toBe(PRESENT_TOOLBAR_CLASSES.wrapper);
		expect(PRESENT_TOOLBAR_VIEW.caret).toBe(PRESENT_TOOLBAR_CLASSES.caret);
		// A literal `w-9 h-9` in the template would drift the moment shared moved.
		expect(source).not.toMatch(/class="[^"]*\bw-9\b/u);
	});

	it('stops every press reaching the stage, so a control never also advances', () => {
		expect(source).toContain('(click)="$event.stopPropagation()"');
		for (const id of ['previous', 'next', 'end']) {
			expect(controlMarkup(id)).toContain(`(touchend)="onControlTouch($event, '${id}')"`);
		}
	});
});

describe('show toolbar disabled states', () => {
	it('disables "previous" on the first slide only', () => {
		expect(isAtFirstSlide(0)).toBeTruthy();
		expect(isAtFirstSlide(1)).toBeFalsy();
		expect(isAtFirstSlide(11)).toBeFalsy();
	});

	it('treats an empty deck as the first slide rather than stepping to -1', () => {
		expect(isAtFirstSlide(-1)).toBeTruthy();
	});

	it('disables "next" on the last slide only', () => {
		expect(isAtLastSlide(0, 12)).toBeFalsy();
		expect(isAtLastSlide(10, 12)).toBeFalsy();
		expect(isAtLastSlide(11, 12)).toBeTruthy();
	});

	it('wires those predicates and the ink guard to the DOM disabled attribute', () => {
		expect(controlMarkup('previous')).toContain('[disabled]="atFirstSlide()"');
		expect(controlMarkup('next')).toContain('[disabled]="atLastSlide()"');
		expect(controlMarkup('clear')).toContain('[disabled]="!hasAnnotations()"');
	});

	it('withholds the destructive hover tint while "clear" is disabled', () => {
		expect(presentToolbarClearClass(false)).not.toContain('hover:text-red-400');
		expect(presentToolbarClearClass(true)).toContain('hover:text-red-400');
	});

	it('tints an armed tool with the shared active token', () => {
		expect(presentToolbarToggleClass(true)).toBe(PRESENT_TOOLBAR_CLASSES.toggleActive);
		expect(presentToolbarToggleClass(false)).toBe(PRESENT_TOOLBAR_CLASSES.toggle);
	});

	it('rings only the swatch matching the tool colour', () => {
		expect(presentToolbarSwatchClass(true)).toContain('border-white');
		expect(presentToolbarSwatchClass(false)).toContain('border-white/20');
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

	it('carries the shared wrapper token and fades via opacity, not display', () => {
		expect(source).toContain("'[class]': 'ui.wrapper'");
		// `duration-300` is the shared fade; hiding with `display` instead would
		// snap the bar away and break the transition the metrics describe.
		expect(PRESENT_TOOLBAR_VIEW.wrapper).toContain('transition-opacity');
		expect(source).toContain("'[style.opacity]'");
		expect(source).toContain("'[style.pointer-events]'");
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

	it('routes the control through the shared state helpers in the template', () => {
		expect(controlMarkup('blackboard')).toContain('[class]="ui.toggleClass(blackboardActive())"');
		expect(source).toContain('isBlackboardActive(');
		expect(source).toContain('runBlackboardToggle(');
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
