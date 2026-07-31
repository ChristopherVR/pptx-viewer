/**
 * ruler-strips.test.ts: the Angular ruler must agree with React / Vue / Svelte /
 * Vanilla, because all five now render the SAME shared `generateTicks` output
 * and resolve a drag off a strip with the SAME shared `rulerDragToGuidePosition`
 * rules. Angular used to own `ruler-ticks.ts` (fixed quarter-inch subdivisions,
 * inches only, no density collapse, a hardcoded `"` on every label) and created
 * a guide on pointer-DOWN off its own stage-relative arithmetic.
 *
 * Angular components cannot be mounted here (no TestBed component factories, see
 * `vitest.config.ts`), so the strips are covered through the two seams the
 * template renders from: `rulerStripTicks` / `rulerHighlight` and
 * `RulerGuidesService`.
 */

import { describe, expect, it } from 'vitest';

import { PX_PER_CM, PX_PER_INCH, RULER_THICKNESS } from '../internal/shared';
import { RulerGuidesService } from './ruler-guides.service';
import { rulerHighlight, rulerStripTicks } from './ruler-strips';

const CANVAS = { width: 960, height: 540 };

describe('rulerStripTicks', () => {
	it('paints nothing while the Rulers toggle is off', () => {
		expect(rulerStripTicks(false, CANVAS.width, 1, 'inches')).toStrictEqual([]);
	});

	it('places a numbered tick every inch at 1x zoom', () => {
		const ticks = rulerStripTicks(true, CANVAS.width, 1, 'inches');
		const labelled = ticks.filter((tick) => tick.label !== '');
		expect(labelled.map((tick) => tick.label)).toStrictEqual([
			'0',
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10',
		]);
		// Labels carry the bare number: the old template appended a `"` suffix
		// that no other binding shows.
		expect(labelled[3]?.label).toBe('3');
		expect(labelled[3]?.position).toBe(3 * PX_PER_INCH);
	});

	it('halves the tick positions at 0.5x zoom', () => {
		const ticks = rulerStripTicks(true, CANVAS.width, 0.5, 'inches');
		const inch3 = ticks.filter((tick) => tick.label !== '')[3];
		expect(inch3?.position).toBe(3 * PX_PER_INCH * 0.5);
	});

	it('thins the labels out at very small zoom instead of overlapping them', () => {
		const dense = rulerStripTicks(true, CANVAS.width, 1, 'inches');
		const sparse = rulerStripTicks(true, CANVAS.width, 0.2, 'inches');
		expect(sparse.filter((tick) => tick.label !== '').length).toBeLessThan(
			dense.filter((tick) => tick.label !== '').length,
		);
	});

	it('supports centimetres, which the old Angular-only generator could not', () => {
		const ticks = rulerStripTicks(true, CANVAS.width, 1, 'centimetres');
		const cm10 = ticks.find((tick) => tick.label === '10');
		expect(cm10?.position).toBeCloseTo(10 * PX_PER_CM, 5);
	});
});

describe('rulerHighlight', () => {
	it('scales the selected element extent onto the strip', () => {
		expect(rulerHighlight(100, 200, 0.5)).toStrictEqual({ start: 50, span: 100 });
	});

	it('keeps a zero-width selection visible as a hairline', () => {
		expect(rulerHighlight(100, 0, 1)).toStrictEqual({ start: 100, span: 1 });
	});

	it('paints nothing without a selection', () => {
		expect(rulerHighlight(undefined, undefined, 1)).toBeNull();
	});
});

/* ------------------------------------------------------------------ */
/*  Drag off a strip -> exactly one guide                             */
/* ------------------------------------------------------------------ */

function service(scale = 1, editable = true): RulerGuidesService {
	const svc = new RulerGuidesService();
	svc.bind({
		editable: () => editable,
		stageElement: () => undefined,
		effectiveScale: () => scale,
		canvasSize: () => CANVAS,
	});
	return svc;
}

/** A pointer event whose `currentTarget` is the strip at the canvas origin. */
function stripEvent(axis: 'h' | 'v', offset: number): PointerEvent {
	const rect =
		axis === 'h'
			? { top: 0, left: 0, width: CANVAS.width, height: RULER_THICKNESS }
			: { top: 0, left: 0, width: RULER_THICKNESS, height: CANVAS.height };
	const strip = {
		getBoundingClientRect: () => rect,
		setPointerCapture: () => {},
		releasePointerCapture: () => {},
	};
	const event = {
		pointerId: 1,
		clientX: axis === 'v' ? offset : 0,
		clientY: axis === 'h' ? offset : 0,
		preventDefault: () => {},
		currentTarget: strip,
	};
	return event as unknown as PointerEvent;
}

describe('rulerGuidesService drag-out', () => {
	it('drops exactly one horizontal guide when the drag leaves the strip', () => {
		const svc = service();
		svc.onRulerPointerDown('h', stripEvent('h', 0));
		svc.onRulerPointerUp('h', stripEvent('h', RULER_THICKNESS + 120));
		expect(svc.rulerGuides()).toHaveLength(1);
		expect(svc.rulerGuides()[0]).toMatchObject({ axis: 'y', pos: 120 });
	});

	it('drops exactly one vertical guide, un-scaled by the stage zoom', () => {
		const svc = service(0.5);
		svc.onRulerPointerDown('v', stripEvent('v', 0));
		svc.onRulerPointerUp('v', stripEvent('v', RULER_THICKNESS + 100));
		expect(svc.rulerGuides()).toHaveLength(1);
		expect(svc.rulerGuides()[0]).toMatchObject({ axis: 'x', pos: 200 });
	});

	it('ignores a click that never left the strip', () => {
		const svc = service();
		svc.onRulerPointerDown('h', stripEvent('h', 0));
		svc.onRulerPointerUp('h', stripEvent('h', RULER_THICKNESS - 2));
		expect(svc.rulerGuides()).toHaveLength(0);
	});

	it('discards a drop past the far edge of the slide', () => {
		const svc = service();
		svc.onRulerPointerDown('h', stripEvent('h', 0));
		svc.onRulerPointerUp('h', stripEvent('h', RULER_THICKNESS + CANVAS.height + 10));
		expect(svc.rulerGuides()).toHaveLength(0);
	});

	it('creates nothing on pointer-up alone (no armed drag)', () => {
		const svc = service();
		svc.onRulerPointerUp('h', stripEvent('h', RULER_THICKNESS + 120));
		expect(svc.rulerGuides()).toHaveLength(0);
	});

	it('stays inert on a read-only canvas', () => {
		const svc = service(1, false);
		svc.onRulerPointerDown('h', stripEvent('h', 0));
		svc.onRulerPointerUp('h', stripEvent('h', RULER_THICKNESS + 120));
		expect(svc.rulerGuides()).toHaveLength(0);
	});
});
