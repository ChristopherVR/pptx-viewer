import { describe, it, expect } from 'vitest';

import {
	getArtisticFilterId,
	needsSvgArtisticFilter,
	buildArtisticEffectDescriptor,
} from './artistic-effects';

// ---------------------------------------------------------------------------
// getArtisticFilterId
// ---------------------------------------------------------------------------

describe('getArtisticFilterId', () => {
	it('generates a stable filter ID from element ID', () => {
		expect(getArtisticFilterId('img-1')).toBe('artistic-fx-img-1');
	});

	it('handles empty element ID', () => {
		expect(getArtisticFilterId('')).toBe('artistic-fx-');
	});

	it('produces different IDs for different elements', () => {
		expect(getArtisticFilterId('a')).not.toBe(getArtisticFilterId('b'));
	});
});

// ---------------------------------------------------------------------------
// needsSvgArtisticFilter
// ---------------------------------------------------------------------------

describe('needsSvgArtisticFilter', () => {
	it('returns false for undefined', () => {
		expect(needsSvgArtisticFilter(undefined)).toBeFalsy();
	});

	it('returns false for CSS-only effects', () => {
		expect(needsSvgArtisticFilter('blur')).toBeFalsy();
		expect(needsSvgArtisticFilter('artisticBlur')).toBeFalsy();
		expect(needsSvgArtisticFilter('lineDrawing')).toBeFalsy();
		expect(needsSvgArtisticFilter('paintStrokes')).toBeFalsy();
		expect(needsSvgArtisticFilter('photocopy')).toBeFalsy();
		expect(needsSvgArtisticFilter('pastelsSmooth')).toBeFalsy();
		expect(needsSvgArtisticFilter('marker')).toBeFalsy();
		expect(needsSvgArtisticFilter('plasticWrap')).toBeFalsy();
		expect(needsSvgArtisticFilter('lightScreen')).toBeFalsy();
		expect(needsSvgArtisticFilter('glowDiffused')).toBeFalsy();
		expect(needsSvgArtisticFilter('sharpen')).toBeFalsy();
	});

	it('returns true for film grain', () => {
		expect(needsSvgArtisticFilter('filmGrain')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticFilmGrain')).toBeTruthy();
	});

	it('returns true for cutout', () => {
		expect(needsSvgArtisticFilter('cutout')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticCutout')).toBeTruthy();
	});

	it('returns true for cement', () => {
		expect(needsSvgArtisticFilter('cement')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticCement')).toBeTruthy();
	});

	it('returns true for texturizer', () => {
		expect(needsSvgArtisticFilter('texturizer')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticTexturizer')).toBeTruthy();
	});

	it('returns true for crisscross etching', () => {
		expect(needsSvgArtisticFilter('crisscrossEtching')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticCrisscrossEtching')).toBeTruthy();
	});

	it('returns true for mosaic effects', () => {
		expect(needsSvgArtisticFilter('mosaic')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticMosaic')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticMosaicBubbles')).toBeTruthy();
		expect(needsSvgArtisticFilter('mosaicBubbles')).toBeTruthy();
	});

	it('returns true for glow edges', () => {
		expect(needsSvgArtisticFilter('glowEdges')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticGlowEdges')).toBeTruthy();
		expect(needsSvgArtisticFilter('glow_edges')).toBeTruthy();
	});

	it('returns true for chalk/sketch effects', () => {
		expect(needsSvgArtisticFilter('chalkSketch')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticChalkSketch')).toBeTruthy();
		expect(needsSvgArtisticFilter('chalk')).toBeTruthy();
	});

	it('returns true for pencil sketch effects', () => {
		expect(needsSvgArtisticFilter('pencilSketch')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticPencilSketch')).toBeTruthy();
		expect(needsSvgArtisticFilter('pencilGrayscale')).toBeTruthy();
		expect(needsSvgArtisticFilter('artisticPencilGrayscale')).toBeTruthy();
		expect(needsSvgArtisticFilter('grayPencil')).toBeTruthy();
	});

	it('returns false for unknown effects', () => {
		expect(needsSvgArtisticFilter('someUnknownEffect')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// buildArtisticEffectDescriptor
// ---------------------------------------------------------------------------

describe('buildArtisticEffectDescriptor', () => {
	it('returns undefined for CSS-only effects', () => {
		expect(buildArtisticEffectDescriptor('el1', 'blur', 5)).toBeUndefined();
		expect(buildArtisticEffectDescriptor('el1', 'artisticBlur', 5)).toBeUndefined();
	});

	it('returns descriptor for film grain', () => {
		const desc = buildArtisticEffectDescriptor('el1', 'artisticFilmGrain', 10);
		expect(desc).toBeDefined();
		expect(desc!.filterId).toBe('artistic-fx-el1');
		expect(desc!.cssFilter).toBe('url(#artistic-fx-el1)');
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for cutout', () => {
		const desc = buildArtisticEffectDescriptor('el2', 'cutout', 50);
		expect(desc).toBeDefined();
		expect(desc!.filterId).toBe('artistic-fx-el2');
		expect(desc!.cssFilter).toContain('url(#artistic-fx-el2)');
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for mosaic', () => {
		const desc = buildArtisticEffectDescriptor('el3', 'mosaic', 8);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for glow edges', () => {
		const desc = buildArtisticEffectDescriptor('el4', 'artisticGlowEdges', 15);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for chalk sketch', () => {
		const desc = buildArtisticEffectDescriptor('el5', 'chalk', 20);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for pencil sketch', () => {
		const desc = buildArtisticEffectDescriptor('el6', 'pencilSketch', 30);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for pencil grayscale', () => {
		const desc = buildArtisticEffectDescriptor('el7', 'pencilGrayscale', 10);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for cement', () => {
		const desc = buildArtisticEffectDescriptor('el8', 'cement', 10);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for texturizer', () => {
		const desc = buildArtisticEffectDescriptor('el9', 'texturizer', 10);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});

	it('returns descriptor for crisscross etching', () => {
		const desc = buildArtisticEffectDescriptor('el10', 'crisscrossEtching', 10);
		expect(desc).toBeDefined();
		expect(desc!.needsSvgFilter).toBeTruthy();
	});
});
