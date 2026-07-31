import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { hasAnimation, setAnimationEntrance } from './animation-authoring';
import {
	applyMotionPathPreset,
	buildMotionPathPreview,
	clearMotionPath,
	hasMotionPath,
	motionPathFor,
	motionPathNativeAnimations,
	setMotionPath,
} from './motion-path-authoring';
import {
	MOTION_PATH_FAMILIES,
	MOTION_PATH_PRESETS,
	motionPathPresetById,
	motionPathPresetIdForPath,
	motionPathPresetsByFamily,
} from './motion-path-presets';

describe('applyMotionPathPreset', () => {
	it('creates an entry with PowerPoint defaults for an element with no animation', () => {
		const next = applyMotionPathPreset([], 'el-1', 'lineRight');
		expect(next).toHaveLength(1);
		expect(next[0]).toMatchObject({
			elementId: 'el-1',
			motionPath: 'M 0 0 L 0.25 0',
			motionPathEditMode: 'relative',
			durationMs: 2000,
			trigger: 'onClick',
			order: 0,
		});
	});

	it('reuses the element existing entry instead of adding a second timeline row', () => {
		const existing: PptxElementAnimation[] = [
			{ elementId: 'el-1', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' },
		];
		const next = applyMotionPathPreset(existing, 'el-1', 'circle');
		expect(next).toHaveLength(1);
		expect(next[0].entrance).toBe('fadeIn');
		expect(next[0].motionPath).toBe(motionPathPresetById('circle')?.path);
		// An existing duration is authored intent and must survive.
		expect(next[0].durationMs).toBe(500);
	});

	it('ignores an unknown preset id rather than blanking the path', () => {
		const existing = applyMotionPathPreset([], 'el-1', 'lineRight');
		expect(applyMotionPathPreset(existing, 'el-1', 'nope')[0].motionPath).toBe('M 0 0 L 0.25 0');
	});

	it('does not mutate its input', () => {
		const input: PptxElementAnimation[] = [];
		applyMotionPathPreset(input, 'el-1', 'lineRight');
		expect(input).toHaveLength(0);
	});
});

describe('setMotionPath / readers', () => {
	it('replaces the raw path (the drag-edit case)', () => {
		const applied = applyMotionPathPreset([], 'el-1', 'lineRight');
		const dragged = setMotionPath(applied, 'el-1', 'M 0 0 L 0.4 -0.2');
		expect(motionPathFor(dragged, 'el-1')).toBe('M 0 0 L 0.4 -0.2');
		expect(hasMotionPath(dragged, 'el-1')).toBeTruthy();
		expect(hasMotionPath(dragged, 'el-2')).toBeFalsy();
	});

	it('counts as an animation so the timing controls stay visible', () => {
		const applied = applyMotionPathPreset([], 'el-1', 'lineRight');
		expect(hasAnimation(applied, 'el-1')).toBeTruthy();
	});
});

describe('clearMotionPath', () => {
	it('drops the entry when the path was the only effect', () => {
		const applied = applyMotionPathPreset([], 'el-1', 'lineRight');
		expect(clearMotionPath(applied, 'el-1')).toStrictEqual([]);
	});

	it('keeps the entry (and the other effects) when they remain', () => {
		let anims = applyMotionPathPreset([], 'el-1', 'lineRight');
		anims = setAnimationEntrance(anims, 'el-1', 'fadeIn');
		const cleared = clearMotionPath(anims, 'el-1');
		expect(cleared).toHaveLength(1);
		expect(cleared[0].motionPath).toBeUndefined();
		expect(cleared[0].entrance).toBe('fadeIn');
	});

	it('reindexes order after removing an entry', () => {
		let anims = applyMotionPathPreset([], 'el-1', 'lineRight');
		anims = applyMotionPathPreset(anims, 'el-2', 'lineLeft');
		const cleared = clearMotionPath(anims, 'el-1');
		expect(cleared.map((a) => [a.elementId, a.order])).toStrictEqual([['el-2', 0]]);
	});
});

describe('clearing a preset does not delete a motion path', () => {
	it('keeps the motion-path-only entry alive', () => {
		let anims = applyMotionPathPreset([], 'el-1', 'lineRight');
		anims = setAnimationEntrance(anims, 'el-1', 'fadeIn');
		anims = setAnimationEntrance(anims, 'el-1', 'none');
		expect(anims).toHaveLength(1);
		expect(anims[0].motionPath).toBe('M 0 0 L 0.25 0');
	});
});

describe('buildMotionPathPreview', () => {
	it('produces keyframes plus a matching animation shorthand', () => {
		const descriptor = buildMotionPathPreview({
			path: 'M 0 0 L 0.25 0',
			slideWidth: 1280,
			slideHeight: 720,
			durationMs: 1500,
			delayMs: 100,
			timingCurve: 'linear',
			uid: 7,
		});
		expect(descriptor?.keyframeName).toBe('pptx-motion-preview-7');
		expect(descriptor?.keyframesCss).toContain('translate(320px, 0px)');
		expect(descriptor?.cssAnimation).toBe(
			'pptx-motion-preview-7 1500ms linear 100ms 1 normal both',
		);
		expect(descriptor?.durationMs).toBe(1500);
	});

	it('returns undefined for a degenerate path', () => {
		expect(
			buildMotionPathPreview({ path: 'M 0 0', slideWidth: 1280, slideHeight: 720 }),
		).toBeUndefined();
	});
});

describe('catalogue lookups', () => {
	it('groups every preset under one of the five PowerPoint families', () => {
		const grouped = MOTION_PATH_FAMILIES.flatMap((family) => motionPathPresetsByFamily(family));
		expect(grouped).toHaveLength(MOTION_PATH_PRESETS.length);
		expect(MOTION_PATH_FAMILIES).toStrictEqual(['lines', 'arcs', 'turns', 'shapes', 'loops']);
	});

	it('names an applied preset path and reports a dragged path as custom', () => {
		expect(motionPathPresetIdForPath('M 0 0  L 0.25 0')).toBe('lineRight');
		expect(motionPathPresetIdForPath('M 0 0 L 0.42 0.11')).toBeUndefined();
		expect(motionPathPresetIdForPath(undefined)).toBeUndefined();
	});
});

describe('motionPathNativeAnimations', () => {
	it('projects an authored path onto the native model so it plays before a save', () => {
		const slide = {
			elements: [],
			animations: applyMotionPathPreset([], 'el-1', 'lineRight'),
		} as unknown as import('pptx-viewer-core').PptxSlide;
		const projected = motionPathNativeAnimations(slide);
		expect(projected).toHaveLength(1);
		expect(projected[0]).toMatchObject({
			targetId: 'el-1',
			presetClass: 'path',
			motionPath: 'M 0 0 L 0.25 0',
			durationMs: 2000,
			trigger: 'onClick',
		});
	});

	it('skips an element the native timeline already animates (reloaded deck)', () => {
		const slide = {
			elements: [],
			animations: applyMotionPathPreset([], 'el-1', 'lineRight'),
			nativeAnimations: [{ targetId: 'el-1', motionPath: 'M 0 0 L 0.25 0' }],
		} as unknown as import('pptx-viewer-core').PptxSlide;
		expect(motionPathNativeAnimations(slide)).toStrictEqual([]);
	});

	it('ignores animations without a path', () => {
		const slide = {
			elements: [],
			animations: [{ elementId: 'el-1', entrance: 'fadeIn' }],
		} as unknown as import('pptx-viewer-core').PptxSlide;
		expect(motionPathNativeAnimations(slide)).toStrictEqual([]);
	});
});
