/**
 * The canvas motion-path overlay, Angular binding.
 *
 * Two things have to hold and neither is obvious from the markup: the path is
 * drawn from the ELEMENT's centre in unscaled slide pixels (it is projected
 * into the scaled stage, so multiplying by zoom here would double-apply it),
 * and dragging the end handle retargets the path in slide FRACTIONS, which is
 * the unit OOXML stores and the unit every other binding reads.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component's inputs are
 * replaced with writable signals and the pointer handlers are called with
 * synthetic events. Without a rendered view the stage cannot be measured, so
 * the scale falls back to 1, which is the case the arithmetic below asserts.
 *
 * Reference binding: packages/react/src/viewer/components/canvas/MotionPathOverlay.tsx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { CanvasSize } from '../internal/shared';
import { MotionPathOverlayComponent } from './motion-path-overlay.component';

const OVERLAY_SOURCE = readFileSync(
	path.join(__dirname, 'motion-path-overlay.component.ts'),
	'utf8',
);

const ELEMENT = {
	id: 'el-1',
	type: 'shape',
	x: 540,
	y: 300,
	width: 200,
	height: 120,
} as unknown as PptxElement;

const CANVAS: CanvasSize = { width: 1280, height: 720 };

/** Protected view state + handlers the overlay template binds to. */
interface OverlayInternals {
	pathD: () => string;
	endPoint: () => { x: number; y: number };
	editable: () => boolean;
	frame: () => { originX: number; originY: number };
	onHandlePointerDown: (event: PointerEvent) => void;
	onHandlePointerMove: (event: PointerEvent) => void;
	onHandlePointerUp: (event: PointerEvent) => void;
}

function createOverlay(
	motionPath: string | undefined,
	options?: { canEdit?: boolean; element?: PptxElement | null },
): { overlay: OverlayInternals; emitted: string[] } {
	const overlay = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new MotionPathOverlayComponent(),
	);
	const animations: PptxElementAnimation[] = motionPath
		? [{ elementId: ELEMENT.id, motionPath } as PptxElementAnimation]
		: [];
	Object.assign(overlay, {
		element: signal(
			options?.element === undefined ? ELEMENT : options.element,
		) as unknown as InputSignal<PptxElement | null>,
		animations: signal(animations) as unknown as InputSignal<readonly PptxElementAnimation[]>,
		canvasSize: signal(CANVAS) as unknown as InputSignal<CanvasSize>,
		canEdit: signal(options?.canEdit ?? true) as unknown as InputSignal<boolean>,
	});
	const emitted: string[] = [];
	vi.spyOn(overlay.pathChange as OutputEmitterRef<string>, 'emit').mockImplementation((value) => {
		emitted.push(value);
	});
	return { overlay: overlay as unknown as OverlayInternals, emitted };
}

/** A pointer event carrying only what the handlers read. */
function pointer(pointerId: number, clientX: number, clientY: number): PointerEvent {
	return {
		pointerId,
		clientX,
		clientY,
		target: null,
		stopPropagation: () => {},
		preventDefault: () => {},
	} as unknown as PointerEvent;
}

describe('motionPathOverlayComponent geometry', () => {
	it('draws the path from the element centre in slide pixels', () => {
		// Centre is (540 + 100, 300 + 60) = (640, 360); +0.25 * 1280 = 960.
		const { overlay } = createOverlay('M 0 0 L 0.25 0');
		expect(overlay.frame()).toMatchObject({ originX: 640, originY: 360 });
		expect(overlay.pathD()).toBe('M 640 360 L 640 360 L 960 360');
	});

	it('places the end handle at the path end', () => {
		const { overlay } = createOverlay('M 0 0 L 0.25 0');
		expect(overlay.endPoint()).toStrictEqual({ x: 960, y: 360 });
	});

	it('draws nothing when the element carries no path', () => {
		expect(createOverlay(undefined).overlay.pathD()).toBe('');
	});

	it('draws nothing on a read-only deck', () => {
		expect(createOverlay('M 0 0 L 0.25 0', { canEdit: false }).overlay.pathD()).toBe('');
	});

	it('draws nothing with no selection', () => {
		expect(createOverlay('M 0 0 L 0.25 0', { element: null }).overlay.pathD()).toBe('');
	});

	it('leaves the handle inert on a closed shape path (no free end)', () => {
		expect(createOverlay('M 0 0 L 0.125 0 L 0.125 -0.2222 Z').overlay.editable()).toBeFalsy();
		expect(createOverlay('M 0 0 L 0.25 0').overlay.editable()).toBeTruthy();
	});
});

describe('motionPathOverlayComponent end-handle drag', () => {
	it('commits a retargeted path in slide fractions', () => {
		const { overlay, emitted } = createOverlay('M 0 0 L 0.25 0');
		overlay.onHandlePointerDown(pointer(1, 0, 0));
		// +128px of 1280 == +0.1 fraction; +72px of 720 == +0.1 fraction.
		overlay.onHandlePointerMove(pointer(1, 128, 72));
		expect(emitted).toStrictEqual(['M 0 0 L 0.35 0.1']);
	});

	it('measures each move from the previous one, not from the gesture start', () => {
		// The host owns the path, so the input here never changes; without the
		// re-anchor the second move would measure 256px (0.2) instead of 128px.
		const { overlay, emitted } = createOverlay('M 0 0 L 0.25 0');
		overlay.onHandlePointerDown(pointer(1, 0, 0));
		overlay.onHandlePointerMove(pointer(1, 128, 0));
		overlay.onHandlePointerMove(pointer(1, 256, 0));
		expect(emitted).toStrictEqual(['M 0 0 L 0.35 0', 'M 0 0 L 0.35 0']);
	});

	it('ignores a move from a pointer that never grabbed the handle', () => {
		const { overlay, emitted } = createOverlay('M 0 0 L 0.25 0');
		overlay.onHandlePointerDown(pointer(1, 0, 0));
		overlay.onHandlePointerMove(pointer(2, 128, 72));
		expect(emitted).toStrictEqual([]);
	});

	it('ignores a drag on a closed shape path', () => {
		const { overlay, emitted } = createOverlay('M 0 0 L 0.125 0 L 0.125 -0.2222 Z');
		overlay.onHandlePointerDown(pointer(1, 0, 0));
		overlay.onHandlePointerMove(pointer(1, 128, 72));
		expect(emitted).toStrictEqual([]);
	});

	it('stops committing once the pointer is released', () => {
		const { overlay, emitted } = createOverlay('M 0 0 L 0.25 0');
		overlay.onHandlePointerDown(pointer(1, 0, 0));
		overlay.onHandlePointerUp(pointer(1, 0, 0));
		overlay.onHandlePointerMove(pointer(1, 128, 72));
		expect(emitted).toStrictEqual([]);
	});
});

describe('motion path overlay DOM contract', () => {
	it('carries the neutral attributes every binding is addressed by', () => {
		expect(OVERLAY_SOURCE).toContain('data-pptx-motion-path-overlay="true"');
		expect(OVERLAY_SOURCE).toContain('data-pptx-motion-path-handle="end"');
		expect(OVERLAY_SOURCE).toContain('role="img"');
		expect(OVERLAY_SOURCE).toContain(
			`[attr.aria-label]="'pptx.animation.motionPath.overlay' | translate"`,
		);
		expect(OVERLAY_SOURCE).toContain(
			`[attr.aria-label]="'pptx.animation.motionPath.endHandle' | translate"`,
		);
	});

	it('draws the dashed sky-blue path React draws', () => {
		expect(OVERLAY_SOURCE).toContain('stroke="#0ea5e9"');
		expect(OVERLAY_SOURCE).toContain('stroke-dasharray="6 4"');
	});
});
