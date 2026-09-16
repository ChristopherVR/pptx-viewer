/**
 * The selection-handle accessible-name contract (template-source assertion
 * pattern, matching `slide-canvas-show-contract.test.ts`; no TestBed here).
 *
 * All five bindings label their manipulation handles from the shared i18n keys
 * `pptx.selectionOverlay.rotate` / `.resize` / the adjust key; Angular used to
 * hardcode "Resize element from se", which is the drift this pins against.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachRotateHandlePlacement } from '../internal/shared';
import { RotateHandlePlacementDirective } from './rotate-handle-placement.directive';

vi.mock(import('../internal/shared'), async (importOriginal) => ({
	...(await importOriginal()),
	attachRotateHandlePlacement: vi.fn(),
}));

const template = readFileSync(join(__dirname, 'slide-canvas.component.html'), 'utf8');

describe('slide-canvas handle accessible names', () => {
	it('uses the shared bounded target without replacing the focusable button or its handlers', () => {
		expect(template).toContain(
			'<span data-pptx-handle-hit [ngStyle]="resizeHitAreaStyle(h.handle)">',
		);
		expect(template).toContain('[style.--pptx-selection-width.px]="singleSelected()?.width"');
		expect(template).toContain('[style.--pptx-selection-height.px]="singleSelected()?.height"');
		expect(template).toContain('(pointerdown)="onHandlePointerDown($event, h.handle)"');
		expect(template).toContain('(keydown)="onResizeHandleKeydown($event, h.handle)"');
	});

	it.each(['pptx-ng-handle', 'pptx-ng-rotate-handle', 'pptx-ng-adjust-handle'])(
		'keeps the theme button-size floor off the explicitly sized %s control',
		(className) => {
			const button = template.match(new RegExp(`<button[^>]*class="${className}"[^>]*>`))?.[0];
			expect(button).toBeDefined();
			expect(button).toContain('data-pptx-compact');
		},
	);

	it('labels resize handles from the shared key with the handle param', () => {
		expect(template).toContain(
			`[attr.aria-label]="'pptx.selectionOverlay.resize' | translate: { handle: h.handle }"`,
		);
		expect(template).not.toContain('Resize element from');
	});

	it('labels the rotate handle from the shared key', () => {
		expect(template).toContain(`[attr.aria-label]="'pptx.selectionOverlay.rotate' | translate"`);
	});

	it('connects shared placement to the current stage and marks the actual obstacles', () => {
		expect(template).toContain('[pptxRotateHandleFor]="singleSelected()?.id"');
		expect(template).toContain('[pptxRotateHandleStage]="stage"');
		for (const kind of ['resize', 'rotate', 'adjust']) {
			expect(template).toContain(`data-pptx-handle-kind="${kind}"`);
		}
		expect(template).toContain('(pointerdown)="onRotatePointerDown($event)"');
		expect(template).toContain('(keydown)="onRotateHandleKeydown($event)"');
	});
});

function createDirective(selectedId: string | undefined = 'shape') {
	const stage = document.createElement('div'),
		button = document.createElement('button'),
		element = document.createElement('div'),
		injector = Injector.create({
			providers: [{ provide: ElementRef, useValue: new ElementRef(button) }],
		}),
		directive = runInInjectionContext(injector, () => new RotateHandlePlacementDirective());
	element.dataset.elementId = selectedId;
	stage.append(element, button);
	document.body.append(stage);
	Object.assign(directive, {
		pptxRotateHandleFor: () => selectedId,
		pptxRotateHandleStage: () => stage,
	});
	return { stage, button, element, directive };
}

describe('angular Rotate placement lifecycle', () => {
	const attach = vi.mocked(attachRotateHandlePlacement);

	beforeEach(() => {
		attach.mockReset().mockReturnValueOnce(vi.fn()).mockReturnValueOnce(vi.fn());
	});
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('attaches only once the button is mounted and keeps the current input identity', () => {
		const { directive, button, stage, element } = createDirective();
		directive.ngOnChanges();
		expect(attach).not.toHaveBeenCalled();
		directive.ngAfterViewInit();
		expect(attach).toHaveBeenCalledOnce();
		expect(attach.mock.lastCall?.[0]).toBe(button);
		expect(attach.mock.lastCall?.[1]?.getSelectionElement?.()).toBe(element);
		expect(attach.mock.lastCall?.[1]?.getObstacleRoot?.()).toBe(stage);
		directive.ngOnChanges();
		expect(attach).toHaveBeenCalledOnce();
		directive.ngOnDestroy();
	});

	it('disposes the old placement when the selection changes, then disposes once on removal', () => {
		const { directive } = createDirective();
		directive.ngAfterViewInit();
		const firstCleanup = attach.mock.results[0].value;
		Object.assign(directive, { pptxRotateHandleFor: () => 'other' });
		directive.ngOnChanges();
		expect(firstCleanup).toHaveBeenCalledOnce();
		expect(attach).toHaveBeenCalledTimes(2);
		const lastCleanup = attach.mock.results[1].value;
		directive.ngOnDestroy();
		directive.ngOnDestroy();
		directive.ngOnChanges();
		expect(lastCleanup).toHaveBeenCalledOnce();
		expect(attach).toHaveBeenCalledTimes(2);
	});

	it('rebinds the same element id when its stage changes', () => {
		const { directive } = createDirective();
		directive.ngAfterViewInit();
		const cleanup = attach.mock.results[0].value,
			stage = document.createElement('div');
		Object.assign(directive, { pptxRotateHandleStage: () => stage });
		directive.ngOnChanges();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(attach).toHaveBeenCalledTimes(2);
		expect(attach.mock.lastCall?.[1]?.getObstacleRoot?.()).toBe(stage);
		directive.ngOnDestroy();
	});

	it('finds ids only in its own stage and resolves replacement nodes live', () => {
		const id = 'shape:one',
			{ directive, element } = createDirective(id),
			other = document.createElement('div');
		other.dataset.elementId = id;
		document.body.prepend(other);
		directive.ngAfterViewInit();
		const getSelectionElement = attach.mock.lastCall?.[1]?.getSelectionElement,
			replacement = element.cloneNode() as HTMLElement;
		expect(getSelectionElement?.()).toBe(element);
		element.replaceWith(replacement);
		expect(getSelectionElement?.()).toBe(replacement);
		replacement.remove();
		expect(getSelectionElement?.()).toBeNull();
		directive.ngOnDestroy();
	});

	it('escapes quotes and backslashes before looking up an authored element id', () => {
		const { directive, stage, element } = createDirective('shape"\\one'),
			query = vi.spyOn(stage, 'querySelector').mockReturnValue(element);
		directive.ngAfterViewInit();
		expect(attach.mock.lastCall?.[1]?.getSelectionElement?.()).toBe(element);
		expect(query).toHaveBeenCalledWith('[data-element-id="shape\\"\\\\one"]');
		directive.ngOnDestroy();
	});

	it('cleans up on deselection and can attach again when an element is selected', () => {
		const { directive } = createDirective();
		directive.ngAfterViewInit();
		const cleanup = attach.mock.results[0].value;
		Object.assign(directive, { pptxRotateHandleFor: () => undefined });
		directive.ngOnChanges();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(attach).toHaveBeenCalledOnce();
		Object.assign(directive, { pptxRotateHandleFor: () => 'shape' });
		directive.ngOnChanges();
		expect(attach).toHaveBeenCalledTimes(2);
		directive.ngOnDestroy();
	});

	it('does not attach without a selected element or stage', () => {
		const { directive } = createDirective();
		Object.assign(directive, { pptxRotateHandleFor: () => undefined });
		directive.ngAfterViewInit();
		expect(attach).not.toHaveBeenCalled();
		Object.assign(directive, {
			pptxRotateHandleFor: () => 'shape',
			pptxRotateHandleStage: () => null,
		});
		directive.ngOnChanges();
		expect(attach).not.toHaveBeenCalled();
		directive.ngOnDestroy();
	});
});
