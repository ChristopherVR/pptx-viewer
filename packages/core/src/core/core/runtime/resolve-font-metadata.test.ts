/**
 * Regression coverage for `resolveFontMetadata` (in
 * `PptxHandlerRuntimeSaveRunProperties.ts`), driven through the real
 * `createRunPropertiesFromTextStyle` via a thin subclass exposing it.
 *
 * The panose-leak fix's first cut (preferring `authoredRunStyle` then
 * `inheritedRunStyle` over the flat, possibly-leaked `style[key]`) was
 * itself too broad: it also stripped a run's LEGITIMATELY inherited
 * metadata whenever the paragraph's own baseline genuinely supplied it
 * (the common case: a paragraph whose runs share one font, collapsed to a
 * single flat style). Measured on a real corpus fixture: 62 `a:latin@panose`
 * / 50 `a:ea@panose` / 16 `a:cs@panose` / 12 `a:sym@panose` newly LOST on
 * one deck alone.
 *
 * The fix compares the CURRENT typeface against the baseline's typeface for
 * that same slot: the baseline's metadata is only valid when the baseline's
 * typeface is what is actually being written.
 */
import { describe, expect, it } from 'vitest';

import type { TextStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

type HyperlinkResolver = (target: string) => string | undefined;

class TestRuntime extends PptxHandlerRuntime {
	public saveRun(style: TextStyle, resolve?: HyperlinkResolver): XmlObject {
		return (
			this as unknown as {
				createRunPropertiesFromTextStyle(s: TextStyle, r?: HyperlinkResolver): XmlObject;
			}
		).createRunPropertiesFromTextStyle(style, resolve);
	}
}

describe('resolveFontMetadata (via createRunPropertiesFromTextStyle)', () => {
	const runtime = new TestRuntime();

	it('keeps the inherited east-asian panose for a run that authored the same typeface without its own panose', () => {
		// A run whose OWN `<a:ea typeface="宋体"/>` matches the paragraph
		// baseline's east-asian font but carries no `@panose` itself (a real
		// shape: `owns()` sees the run authored `eastAsiaFont` at all, even
		// though the VALUE happens to equal the baseline, and writes the
		// typeface). The metadata comes from the SAME cascade that supplied
		// the (matching) typeface and must survive.
		const baseline: TextStyle = {
			eastAsiaFont: '宋体',
			eastAsiaFontPanose: '02010600030101010101',
		};
		const style: TextStyle = {
			...baseline,
			authoredRunStyle: { eastAsiaFont: '宋体' },
			inheritedRunStyle: baseline,
		};
		const rPr = runtime.saveRun(style);
		expect((rPr['a:ea'] as XmlObject)['@_typeface']).toBe('宋体');
		expect((rPr['a:ea'] as XmlObject)['@_panose']).toBe('02010600030101010101');
	});

	it('does not borrow the baseline panose for a run whose own typeface differs', () => {
		// The regression this whole fix targets: a run authoring its OWN
		// different east-asian typeface (no panose of its own) must not
		// inherit the panose that describes the PARAGRAPH baseline's
		// different font.
		const baseline: TextStyle = {
			eastAsiaFont: '宋体',
			eastAsiaFontPanose: '02010600030101010101',
		};
		const style: TextStyle = {
			...baseline,
			eastAsiaFont: 'Abraham Lincoln',
			authoredRunStyle: { eastAsiaFont: 'Abraham Lincoln' },
			inheritedRunStyle: baseline,
		};
		const rPr = runtime.saveRun(style);
		expect((rPr['a:ea'] as XmlObject)['@_typeface']).toBe('Abraham Lincoln');
		expect((rPr['a:ea'] as XmlObject)['@_panose']).toBeUndefined();
	});

	it("uses the run's own authored panose over the baseline when both are present", () => {
		const baseline: TextStyle = {
			eastAsiaFont: '宋体',
			eastAsiaFontPanose: '02010600030101010101',
		};
		const style: TextStyle = {
			...baseline,
			eastAsiaFont: 'MS Gothic',
			eastAsiaFontPanose: '020B0609070205080204',
			authoredRunStyle: { eastAsiaFont: 'MS Gothic', eastAsiaFontPanose: '020B0609070205080204' },
			inheritedRunStyle: baseline,
		};
		const rPr = runtime.saveRun(style);
		expect((rPr['a:ea'] as XmlObject)['@_typeface']).toBe('MS Gothic');
		expect((rPr['a:ea'] as XmlObject)['@_panose']).toBe('020B0609070205080204');
	});

	it('trusts the flat field directly when no authored/inherited split was ever recorded', () => {
		// SDK-built content / a synthetic style: no baseline exists, so
		// `createRunStyleGate` passes everything, and there is no split to
		// prefer over the flat value.
		const style: TextStyle = {
			eastAsiaFont: 'Yu Gothic',
			eastAsiaFontPanose: '020B0400000000000000',
		};
		const rPr = runtime.saveRun(style);
		expect((rPr['a:ea'] as XmlObject)['@_typeface']).toBe('Yu Gothic');
		expect((rPr['a:ea'] as XmlObject)['@_panose']).toBe('020B0400000000000000');
	});
});
