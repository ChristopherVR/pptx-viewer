/**
 * presentation-toolbar.component.test.ts: guards for the slide-show toolbar.
 *
 * This package has no TestBed (see `vitest.config.ts`), so the inventory guards
 * read the component's authored template as text via `componentSource`, the
 * same technique the element-renderer and context-menu contract specs use. That
 * is not a weaker assertion than rendering for what is being checked here: the
 * template is static markup, so "the 16 shared control ids appear once each, in
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
import { componentSource } from './component-source.test-support';
import {
	PRESENT_TOOLBAR_VIEW,
	PresentToolbarAutoHide,
	isAtFirstSlide,
	isAtLastSlide,
	presentToolbarClearClass,
	presentToolbarSwatchClass,
	presentToolbarToggleClass,
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

	it('renders all sixteen slots, not the old five-button annotation strip', () => {
		expect(renderedControlIds()).toHaveLength(16);
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
