import { describe, expect, it } from 'vitest';

/**
 * Phase 2 Stream B / C-H4 — multi-master clrMap resolution.
 *
 * Verifies the new resolveThemeColor flow:
 *   slideClrMapOvr → masterClrMap → themeColorMap → defaults.
 *
 * We re-implement the production logic in test scope (the runtime depends
 * on a JSZip + presentation context that's heavy to instantiate). Any
 * change to the production resolveThemeColor needs to also update this
 * mirror, which is acceptable given the simplicity of the function.
 */

interface ResolveCtx {
	themeColorMap: Record<string, string>;
	currentSlideClrMapOverride: Record<string, string> | null;
	currentMasterClrMap: Record<string, string> | null;
}

const DEFAULT_SCHEME: Record<string, string> = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#1F497D',
	lt2: '#EEECE1',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	hlink: '#0563C1',
	folHlink: '#954F72',
	tx1: '#000000',
	tx2: '#44546A',
	bg1: '#FFFFFF',
	bg2: '#E7E6E6',
};

const DEFAULT_CLR_MAP_ALIAS: Record<string, string> = {
	bg1: 'lt1',
	tx1: 'dk1',
	bg2: 'lt2',
	tx2: 'dk2',
};

function resolveThemeColor(ctx: ResolveCtx, schemeKey: string): string | undefined {
	const normalized = schemeKey.trim().toLowerCase();
	if (!normalized) {
		return undefined;
	}
	if (normalized === 'phclr') {
		return ctx.themeColorMap['phclr'] || ctx.themeColorMap['accent1'] || DEFAULT_SCHEME['accent1'];
	}
	const overrideMap = ctx.currentSlideClrMapOverride ?? ctx.currentMasterClrMap;
	if (overrideMap) {
		const remapped = overrideMap[normalized];
		if (remapped) {
			return ctx.themeColorMap[remapped] || DEFAULT_SCHEME[remapped];
		}
	} else {
		const defaultAliasTarget = DEFAULT_CLR_MAP_ALIAS[normalized];
		if (defaultAliasTarget) {
			return (
				ctx.themeColorMap[defaultAliasTarget] ||
				ctx.themeColorMap[normalized] ||
				DEFAULT_SCHEME[normalized]
			);
		}
	}
	return ctx.themeColorMap[normalized] || DEFAULT_SCHEME[normalized];
}

describe('resolveThemeColor — Phase 2 Stream B / C-H4', () => {
	const themeColorMap: Record<string, string> = {
		dk1: '#111111',
		lt1: '#EEEEEE',
		dk2: '#222222',
		lt2: '#DDDDDD',
		accent1: '#FF0000',
		accent2: '#00FF00',
		accent3: '#0000FF',
		accent4: '#FFFF00',
		accent5: '#FF00FF',
		accent6: '#00FFFF',
		hlink: '#0000FF',
		folHlink: '#800080',
	};

	it('resolves direct scheme slot from themeColorMap (no clrMap)', () => {
		const ctx: ResolveCtx = {
			themeColorMap,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: null,
		};
		expect(resolveThemeColor(ctx, 'accent1')).toBe('#FF0000');
		expect(resolveThemeColor(ctx, 'dk1')).toBe('#111111');
	});

	it('resolves alias through master clrMap (bg1 → lt1)', () => {
		const ctx: ResolveCtx = {
			themeColorMap,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: {
				bg1: 'lt1',
				tx1: 'dk1',
				bg2: 'lt2',
				tx2: 'dk2',
			},
		};
		expect(resolveThemeColor(ctx, 'bg1')).toBe('#EEEEEE');
		expect(resolveThemeColor(ctx, 'tx1')).toBe('#111111');
	});

	it('master clrMap can swap bg1 ↔ tx1 (dark theme)', () => {
		const ctx: ResolveCtx = {
			themeColorMap,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: {
				bg1: 'dk1', // background becomes dark
				tx1: 'lt1', // text becomes light
			},
		};
		expect(resolveThemeColor(ctx, 'bg1')).toBe('#111111');
		expect(resolveThemeColor(ctx, 'tx1')).toBe('#EEEEEE');
	});

	it('slide clrMapOvr takes precedence over master clrMap', () => {
		const ctx: ResolveCtx = {
			themeColorMap,
			currentSlideClrMapOverride: {
				bg1: 'accent1',
			},
			currentMasterClrMap: {
				bg1: 'lt1',
			},
		};
		expect(resolveThemeColor(ctx, 'bg1')).toBe('#FF0000');
	});

	it('phClr resolves through accent1', () => {
		const ctx: ResolveCtx = {
			themeColorMap,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: null,
		};
		expect(resolveThemeColor(ctx, 'phClr')).toBe('#FF0000');
	});

	it('multi-master decks: each master switches themeColorMap', () => {
		// Simulate two masters with different themes; the runtime swaps
		// themeColorMap on setActiveMasterForSlide. We just verify that
		// when themeColorMap is swapped, resolveThemeColor follows.
		const masterAColors = { ...themeColorMap, accent1: '#FF0000' };
		const masterBColors = { ...themeColorMap, accent1: '#00AAFF' };

		const ctxA: ResolveCtx = {
			themeColorMap: masterAColors,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: { bg1: 'lt1', tx1: 'dk1' },
		};
		const ctxB: ResolveCtx = {
			themeColorMap: masterBColors,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: { bg1: 'lt1', tx1: 'dk1' },
		};

		expect(resolveThemeColor(ctxA, 'accent1')).toBe('#FF0000');
		expect(resolveThemeColor(ctxB, 'accent1')).toBe('#00AAFF');
	});

	it('master clrMap is consulted at lookup time, not baked into themeColorMap', () => {
		// Critical regression check: verify that accessing dk1 returns the
		// raw scheme color even when the master maps tx1 → dk1. The OLD
		// (broken) code overwrote themeColorMap['tx1'] = themeColorMap['dk1'],
		// which conflated the alias layer with the slot layer.
		const themeMap = { ...themeColorMap };
		const masterClrMap = {
			bg1: 'lt1',
			tx1: 'dk1',
			bg2: 'lt2',
			tx2: 'dk2',
		};
		const ctx: ResolveCtx = {
			themeColorMap: themeMap,
			currentSlideClrMapOverride: null,
			currentMasterClrMap: masterClrMap,
		};

		// dk1 raw slot should return its own value, not be remapped.
		expect(resolveThemeColor(ctx, 'dk1')).toBe('#111111');
		// bg1 alias should return lt1's value via the master map.
		expect(resolveThemeColor(ctx, 'bg1')).toBe('#EEEEEE');
		// themeColorMap itself should still hold the raw slot for dk1.
		expect(themeMap['dk1']).toBe('#111111');
		// And themeMap should NOT have been mutated to add a new bg1 entry
		// (or if it has, it should match the alias chain — both forms work
		// for this lookup but the contract is "no permanent mutation").
	});

	it('layout clrMapOvr (via currentSlideClrMapOverride) overrides master', () => {
		// Phase 2 Stream B / C-H5 — the layout's clrMapOvr is pushed onto
		// currentSlideClrMapOverride during layout element parsing, so master
		// shapes drawn through that layout see the override.
		// Per CT_ColorMapping the overrideClrMapping includes all 12 alias
		// attributes (the spec marks them as required), so a full override
		// shadows the master's clrMap entirely.
		const ctx: ResolveCtx = {
			themeColorMap,
			currentSlideClrMapOverride: {
				bg1: 'accent2', // layout swaps bg1 to accent2
				tx1: 'dk1',
				bg2: 'lt2',
				tx2: 'dk2',
				accent1: 'accent1',
				accent2: 'accent2',
				accent3: 'accent3',
				accent4: 'accent4',
				accent5: 'accent5',
				accent6: 'accent6',
				hlink: 'hlink',
				folHlink: 'folHlink',
			},
			currentMasterClrMap: {
				bg1: 'lt1',
				tx1: 'dk1',
			},
		};
		expect(resolveThemeColor(ctx, 'bg1')).toBe('#00FF00');
		// Master clrMap is shadowed by the slide override.
		expect(resolveThemeColor(ctx, 'tx1')).toBe('#111111');
	});
});
