/**
 * Tests for the renderer-injected shape-effect helpers: the soft-edge `<filter>`
 * descriptor, the DAG fill-overlay tint accessor, and the CSS-filter resolver
 * that keeps only injected `url(#…)` references.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { DuotoneFilterDef } from './duotone-filter';
import {
	getEffectFillOverlay,
	getReflectionOverlay,
	getSoftEdgeFilterDef,
	resolveShapeFilterCss,
} from './element-effect-defs';

function shape(shapeStyle?: ShapeStyle, id = 's1'): PptxElement {
	return {
		type: 'shape',
		id,
		name: '',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
	} as PptxElement;
}

describe('getSoftEdgeFilterDef', () => {
	it('returns undefined when no soft edge is set', () => {
		expect(getSoftEdgeFilterDef(shape({}))).toBeUndefined();
		expect(getSoftEdgeFilterDef(shape({ softEdgeRadius: 0 }))).toBeUndefined();
	});

	it('returns a stable id + rounded radius for a soft edge', () => {
		const def = getSoftEdgeFilterDef(shape({ softEdgeRadius: 6.4 }, 'abc'));
		expect(def).toStrictEqual({ id: 'soft-edge-abc', radius: 6 });
	});
});

describe('getEffectFillOverlay', () => {
	it('returns undefined with no DAG fill overlay', () => {
		expect(getEffectFillOverlay(shape({}))).toBeUndefined();
	});

	it('returns colour + blend mode for a DAG fill overlay', () => {
		const overlay = getEffectFillOverlay(
			shape({ dagFillOverlayColor: '#FF0000', dagFillOverlayBlend: 'mult' }),
		);
		expect(overlay).toBeDefined();
		expect(overlay?.color).toContain('#FF0000');
		expect(overlay?.blendMode).toBe('multiply');
	});
});

describe('getReflectionOverlay', () => {
	it('returns undefined without a reflection', () => {
		expect(getReflectionOverlay(shape({}), new Map())).toBeUndefined();
	});

	it('resolves the mirrored fill for a shape (no -webkit-box-reflect)', () => {
		const overlay = getReflectionOverlay(
			shape({ fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 }),
			new Map(),
		);
		expect(overlay?.wrapperStyle.top).toBe('calc(100% + 4px)');
		expect(overlay?.wrapperStyle.transform).toBe('scaleY(-1)');
		expect(JSON.stringify(overlay)).not.toContain('box-reflect');
		expect(overlay?.fill?.backgroundColor).toBe('#ff0000');
		expect(overlay?.imgSrc).toBeUndefined();
	});

	it('resolves the mirrored <img> src for a picture element', () => {
		const picture = {
			type: 'picture',
			id: 'pic1',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			imageData: 'data:image/png;base64,AAAA',
			shapeStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
		} as unknown as PptxElement;
		const overlay = getReflectionOverlay(picture, new Map());
		expect(overlay?.imgSrc).toBe('data:image/png;base64,AAAA');
		expect(overlay?.fill).toBeUndefined();
	});
});

describe('resolveShapeFilterCss', () => {
	const softEdge = { id: 'soft-edge-s1', radius: 6 };
	const duotone = { id: 'dag-duotone-s1', cssFilter: 'url(#dag-duotone-s1)' } as DuotoneFilterDef;

	it('returns undefined when no filter and no duotone', () => {
		expect(resolveShapeFilterCss(undefined, undefined, undefined)).toBeUndefined();
	});

	it('falls back to the duotone cssFilter when the effect layer has none', () => {
		expect(resolveShapeFilterCss(undefined, duotone, undefined)).toBe('url(#dag-duotone-s1)');
	});

	it('keeps the soft-edge url ref (its def is injected)', () => {
		const out = resolveShapeFilterCss('url(#soft-edge-s1)', undefined, softEdge);
		expect(out).toBe('url(#soft-edge-s1)');
	});

	it('strips a dangling url ref when neither duotone nor soft edge is injected', () => {
		const out = resolveShapeFilterCss('blur(2px) url(#soft-edge-s1)', undefined, undefined);
		expect(out).toBe('blur(2px)');
	});

	it('keeps every url ref when the duotone def is injected', () => {
		const out = resolveShapeFilterCss('url(#soft-edge-s1) url(#dag-duotone-s1)', duotone, softEdge);
		expect(out).toBe('url(#soft-edge-s1) url(#dag-duotone-s1)');
	});
});
