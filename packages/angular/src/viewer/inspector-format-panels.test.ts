/**
 * Unit coverage for the pure logic behind the inspector's newer format panels
 * (3D text, slide transition). The Angular suite is deliberately TestBed-free,
 * so component DOM behaviour is covered by the e2e specs and only the exported
 * pure helpers are asserted here.
 */
import { describe, expect, it } from 'vitest';

import { clampTransitionNumber, mergeSlideTransition } from '../internal/shared';
import { TEXT_3D_TOP_BEVEL_KEYS, bevelSizePatch } from './text-3d-bevel-section.component';

describe('text 3d bevel patches', () => {
	it('converts an edited bevel width from points to EMU', () => {
		expect(bevelSizePatch(TEXT_3D_TOP_BEVEL_KEYS.width, 3)).toStrictEqual({
			bevelTopWidth: 38100,
		});
	});

	it('clamps a bevel size into the offered range', () => {
		expect(bevelSizePatch(TEXT_3D_TOP_BEVEL_KEYS.height, 900)).toStrictEqual({
			bevelTopHeight: 50 * 12700,
		});
		expect(bevelSizePatch(TEXT_3D_TOP_BEVEL_KEYS.height, -4)).toStrictEqual({
			bevelTopHeight: 0,
		});
	});
});

// The transition merge/clamp themselves live in `pptx-viewer-shared`; these
// cases pin the VENDORED copy Angular actually compiles against.
describe('slide transition patches', () => {
	it('clamps and rounds an edited numeric field', () => {
		expect(clampTransitionNumber(50000, 0, 10000)).toBe(10000);
		expect(clampTransitionNumber(-1, 1, 8)).toBe(1);
		expect(clampTransitionNumber(3.6, 1, 8)).toBe(4);
	});

	it('rejects a non-numeric field so the model is left untouched', () => {
		expect(clampTransitionNumber(Number.NaN, 0, 10000)).toBeNull();
	});

	it('merges a change without dropping the authored sound or direction', () => {
		expect(
			mergeSlideTransition(
				{ type: 'push', direction: 'l', soundFileName: 'chime.wav' },
				{ durationMs: 600 },
			),
		).toStrictEqual({
			type: 'push',
			direction: 'l',
			soundFileName: 'chime.wav',
			durationMs: 600,
		});
	});

	it('defaults the required type when the slide had no transition at all', () => {
		expect(mergeSlideTransition(undefined, { durationMs: 200 })).toStrictEqual({
			type: 'none',
			durationMs: 200,
		});
	});
});
