import type { TextSegment, TextStyle } from 'pptx-viewer-core';
/**
 * Unit tests for the pure label-geometry helpers extracted from
 * `connector-text-overlay.component.ts`.
 *
 * All tested functions are pure (no Angular dependency, no TestBed) so they
 * can run under plain vitest + happy-dom, matching the test-setup convention
 * used by the rest of the Angular package (see `connector-path.ts` tests).
 *
 * React / Vue references:
 *   packages/vue/src/viewer/components/ConnectorTextOverlay.vue
 */
import { describe, expect, it } from 'vitest';

import {
	buildOverlayBlockStyle,
	buildOverlayContainerStyle,
	buildSegmentStyle,
} from './connector-text-overlay.component';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seg(text: string, style: TextStyle = {}): TextSegment {
	return { text, style };
}

// ---------------------------------------------------------------------------
// buildOverlayContainerStyle
// ---------------------------------------------------------------------------

describe('buildOverlayContainerStyle', () => {
	it('defaults text-align to center when align is undefined', () => {
		const style = buildOverlayContainerStyle(undefined);
		expect(style).toContain('text-align:center');
	});

	it('maps left / right / center alignment directly', () => {
		expect(buildOverlayContainerStyle('left')).toContain('text-align:left');
		expect(buildOverlayContainerStyle('right')).toContain('text-align:right');
		expect(buildOverlayContainerStyle('center')).toContain('text-align:center');
	});

	it('maps justify directly', () => {
		expect(buildOverlayContainerStyle('justify')).toContain('text-align:justify');
	});

	it('collapses "justLow" to justify', () => {
		expect(buildOverlayContainerStyle('justLow')).toContain('text-align:justify');
	});

	it('collapses "dist" to justify', () => {
		expect(buildOverlayContainerStyle('dist')).toContain('text-align:justify');
	});

	it('collapses "thaiDist" to justify', () => {
		expect(buildOverlayContainerStyle('thaiDist')).toContain('text-align:justify');
	});

	it('includes the fixed flex / positioning properties', () => {
		const style = buildOverlayContainerStyle(undefined);
		expect(style).toContain('position:absolute');
		expect(style).toContain('display:flex');
		expect(style).toContain('align-items:center');
		expect(style).toContain('justify-content:center');
		expect(style).toContain('overflow:hidden');
		expect(style).toContain('pointer-events:none');
	});
});

// ---------------------------------------------------------------------------
// buildOverlayBlockStyle
// ---------------------------------------------------------------------------

describe('buildOverlayBlockStyle', () => {
	it('falls back to sensible defaults when textStyle is undefined', () => {
		const style = buildOverlayBlockStyle(undefined);
		expect(style).toContain('font-family:inherit');
		expect(style).toContain('font-size:10px');
		expect(style).toContain('color:#000000');
		expect(style).toContain('font-weight:normal');
		expect(style).toContain('font-style:normal');
		expect(style).toContain('text-decoration:none');
	});

	it('applies font family from textStyle', () => {
		const style = buildOverlayBlockStyle({ fontFamily: 'Arial' });
		expect(style).toContain('font-family:Arial');
	});

	it('applies font size from textStyle (in points)', () => {
		const style = buildOverlayBlockStyle({ fontSize: 14 });
		expect(style).toContain('font-size:14px');
	});

	it('applies colour from textStyle', () => {
		const style = buildOverlayBlockStyle({ color: '#ff0000' });
		expect(style).toContain('color:#ff0000');
	});

	it('applies bold weight', () => {
		const style = buildOverlayBlockStyle({ bold: true });
		expect(style).toContain('font-weight:bold');
	});

	it('applies italic style', () => {
		const style = buildOverlayBlockStyle({ italic: true });
		expect(style).toContain('font-style:italic');
	});

	it('applies underline text decoration', () => {
		const style = buildOverlayBlockStyle({ underline: true });
		expect(style).toContain('text-decoration:underline');
	});

	it('includes the fixed block layout properties', () => {
		const style = buildOverlayBlockStyle(undefined);
		expect(style).toContain('padding:0 4px');
		expect(style).toContain('white-space:pre-wrap');
		expect(style).toContain('line-height:1.2');
		expect(style).toContain('max-width:100%');
	});
});

// ---------------------------------------------------------------------------
// buildSegmentStyle
// ---------------------------------------------------------------------------

describe('buildSegmentStyle', () => {
	it('falls back to paragraph defaults when the run has no overrides', () => {
		const ts: TextStyle = {
			fontFamily: 'Calibri',
			fontSize: 12,
			color: '#333333',
			bold: true,
			italic: false,
			underline: false,
		};
		const style = buildSegmentStyle(seg('hello'), ts);
		expect(style).toContain('font-family:Calibri');
		expect(style).toContain('color:#333333');
		expect(style).toContain('font-weight:bold');
		expect(style).toContain('font-style:normal');
		expect(style).toContain('text-decoration:none');
		// font-size is only emitted when the run has an explicit value
		expect(style).not.toContain('font-size');
	});

	it('run overrides take priority over paragraph defaults', () => {
		const ts: TextStyle = { color: '#000000', bold: false };
		const s = seg('bold run', { color: '#ff0000', bold: true });
		const style = buildSegmentStyle(s, ts);
		expect(style).toContain('color:#ff0000');
		expect(style).toContain('font-weight:bold');
	});

	it('emits font-size in points when the run specifies one', () => {
		const s = seg('big', { fontSize: 20 });
		const style = buildSegmentStyle(s, undefined);
		expect(style).toContain('font-size:20px');
	});

	it('omits font-size when neither run nor paragraph has one', () => {
		const style = buildSegmentStyle(seg('text'), undefined);
		expect(style).not.toContain('font-size');
	});

	it('defaults to black / normal / inherit when no styles are provided', () => {
		const style = buildSegmentStyle(seg('text'), undefined);
		expect(style).toContain('color:#000000');
		expect(style).toContain('font-weight:normal');
		expect(style).toContain('font-style:normal');
		expect(style).toContain('font-family:inherit');
	});

	it('handles italic override from a run', () => {
		const style = buildSegmentStyle(seg('slant', { italic: true }), undefined);
		expect(style).toContain('font-style:italic');
	});

	it('handles underline override from a run', () => {
		const style = buildSegmentStyle(seg('under', { underline: true }), undefined);
		expect(style).toContain('text-decoration:underline');
	});

	it('inherits paragraph-level bold when the run does not set bold itself', () => {
		// ts has bold: true; the run style has bold: false (not explicitly set by author).
		// The Vue reference mirrors this: `s?.bold ? 'bold' : ts?.bold ? 'bold' : 'normal'`
		// a run-style `bold: false` still inherits paragraph bold because the ternary
		// evaluates `ts?.bold` as the fallback when `s?.bold` is falsy.
		const ts: TextStyle = { bold: true };
		const s = seg('inherits bold', { bold: false });
		const style = buildSegmentStyle(s, ts);
		// Paragraph bold propagates to the run.
		expect(style).toContain('font-weight:bold');
	});
});
