import type { PptxTheme } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { makeMockBridge } from '../mock-bridge';
import { ProposalStore } from '../proposals';
import type { AiToolContext } from './executor-base';
import type { ThemeApplyResult } from './theme-tools';
import { themeExecutors } from './theme-tools';

/**
 * Theme executors apply immediately (never staged) and return a `previous`
 * snapshot so the host can offer an inline Undo. These tests assert the
 * immediate apply, the summary copy, and that feeding `previous` back into
 * `applyTheme` restores the prior values.
 */

function baseTheme(): PptxTheme {
	return {
		name: 'Office',
		colorScheme: {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#44546A',
			lt2: '#E7E6E6',
			accent1: '#4472C4',
			accent2: '#ED7D31',
			accent3: '#A5A5A5',
			accent4: '#FFC000',
			accent5: '#5B9BD5',
			accent6: '#70AD47',
			hlink: '#0563C1',
			folHlink: '#954F72',
		},
	} as unknown as PptxTheme;
}

function makeCtx() {
	const bridge = makeMockBridge({ theme: baseTheme() });
	const ctx: AiToolContext = {
		bridge,
		proposals: new ProposalStore(bridge),
		writePolicy: 'stage',
	};
	return { bridge, ctx };
}

describe('theme executors (immediate apply + undo snapshot)', () => {
	it('update_theme_colors applies immediately and reports the previous colours', () => {
		const { bridge, ctx } = makeCtx();
		const before = bridge.getTheme()?.colorScheme?.accent1;

		const result = themeExecutors.update_theme_colors(ctx, {
			accent1: '#FF0000',
		}) as ThemeApplyResult;

		expect(result.applied).toBeTruthy();
		expect(result.themeEdit).toBe('colors');
		expect(result.summary).toContain('accent1');
		// Applied straight to the deck (not staged).
		expect(ctx.proposals.size).toBe(0);
		expect(bridge.getTheme()?.colorScheme?.accent1).toBe('#FF0000');
		expect(result.previous.colorScheme?.accent1).toBe(before);

		// Undo restores the prior scheme.
		bridge.applyTheme(result.previous);
		expect(bridge.getTheme()?.colorScheme?.accent1).toBe(before);
	});

	it('apply_theme_preset applies immediately and snapshots the previous theme', () => {
		const { bridge, ctx } = makeCtx();
		const before = bridge.getTheme()?.colorScheme;

		const result = themeExecutors.apply_theme_preset(ctx, {
			presetName: 'MODERN_BLUE',
		}) as ThemeApplyResult;

		expect(result.applied).toBeTruthy();
		expect(result.themeEdit).toBe('preset');
		expect(result.summary.toLowerCase()).toContain('preset');
		expect(ctx.proposals.size).toBe(0);
		expect(result.previous.colorScheme).toStrictEqual(before);
	});

	it('rejects an update with no colour fields', () => {
		const { ctx } = makeCtx();
		expect(() => themeExecutors.update_theme_colors(ctx, {})).toThrow();
	});
});
