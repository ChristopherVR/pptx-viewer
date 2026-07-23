/**
 * Colour-fidelity tests for the sp3d extrusion/contour CSS approximation:
 * real `extrusionClr`/`contourClr` are honoured, bare-hex values are normalised
 * to valid CSS, and the resolved shape fill/stroke colour is used as the
 * PowerPoint-default fallback when those attributes are omitted.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getComputed3dStyle, getContourBoxShadow, getExtrusionBoxShadow } from './visual-3d';

describe('getExtrusionBoxShadow colour fidelity', () => {
	it('honours an explicit extrusion colour', () => {
		const shadow = getExtrusionBoxShadow({ extrusionHeight: 95250, extrusionColor: '#4472C4' });
		expect(shadow).toContain('#4472C4');
	});

	it('falls back to the resolved fill colour when extrusionClr is omitted', () => {
		const shadow = getExtrusionBoxShadow({ extrusionHeight: 95250 }, 0, 0, '#AA3355');
		expect(shadow).toContain('#AA3355');
		expect(shadow).not.toContain('#888888');
	});

	it('normalises a bare (no-#) extrusion colour into a valid CSS hex', () => {
		const shadow = getExtrusionBoxShadow({ extrusionHeight: 95250, extrusionColor: 'FF0000' });
		expect(shadow).toContain('#FF0000');
	});

	it('uses the neutral grey only when neither colour is a valid hex', () => {
		const shadow = getExtrusionBoxShadow(
			{ extrusionHeight: 95250, extrusionColor: 'rgb(1,2,3)' },
			0,
			0,
			'transparent',
		);
		expect(shadow).toContain('#888888');
	});

	it('returns undefined when there is no extrusion depth', () => {
		expect(getExtrusionBoxShadow({ extrusionHeight: 0 })).toBeUndefined();
		expect(getExtrusionBoxShadow(undefined)).toBeUndefined();
	});
});

describe('getContourBoxShadow colour fidelity', () => {
	it('honours an explicit contour colour and faithful width', () => {
		// 19050 EMU / 9525 = 2px ring.
		expect(getContourBoxShadow({ contourWidth: 19050, contourColor: '#00AA00' })).toBe(
			'0 0 0 2px #00AA00',
		);
	});

	it('falls back to the line colour when contourClr is omitted', () => {
		expect(getContourBoxShadow({ contourWidth: 9525 }, '#123456')).toBe('0 0 0 1px #123456');
	});

	it('normalises a bare (no-#) contour colour', () => {
		expect(getContourBoxShadow({ contourWidth: 9525, contourColor: 'FF0000' })).toBe(
			'0 0 0 1px #FF0000',
		);
	});

	it('defaults to black when no colour resolves', () => {
		expect(getContourBoxShadow({ contourWidth: 9525 })).toBe('0 0 0 1px #000000');
	});
});

describe('getComputed3dStyle threads the resolved fill/stroke colour', () => {
	function shapeWith3d(shape3d: Record<string, unknown>, extra: Record<string, unknown> = {}) {
		return {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: { fillColor: '#4472C4', strokeColor: '#204060', shape3d, ...extra },
		} as unknown as PptxElement;
	}

	it('uses fillColor for the extrusion side faces when extrusionClr is absent', () => {
		const style = getComputed3dStyle(shapeWith3d({ extrusionHeight: 95250 }));
		expect(style?.extrusionBoxShadow).toContain('#4472C4');
	});

	it('uses strokeColor for the contour ring when contourClr is absent', () => {
		const style = getComputed3dStyle(shapeWith3d({ contourWidth: 19050 }));
		expect(style?.boxShadow).toContain('#204060');
	});
});
