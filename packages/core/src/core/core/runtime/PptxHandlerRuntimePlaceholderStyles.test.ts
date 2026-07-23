import { describe, it, expect } from 'vitest';

import type { PlaceholderTextLevelStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

// ---------------------------------------------------------------------------
// Regression coverage for themed bullet colours (issue #75).
//
// The `a:buClr` bullet colour must route through the shared `parseColor`
// helper so scheme / sys / prst / hsl / scrgb colour choices resolve, not
// only the literal `a:srgbClr/@_val`. A `<a:buClr><a:schemeClr val="accent1"/>`
// is standard in the Office master bodyStyle, so dropping it left bullets
// with no / incorrect colour.
// ---------------------------------------------------------------------------

/**
 * Thin subclass that seeds a deterministic theme colour map and exposes the
 * otherwise-protected `parsePlaceholderLevelStyle` for direct assertion.
 */
class TestRuntime extends PptxHandlerRuntime {
	public constructor() {
		super();
		// Seed the live theme map so `a:schemeClr` references resolve.
		(this as unknown as { themeColorMap: Record<string, string> }).themeColorMap = {
			accent1: '#0070C0',
		};
	}

	public parseLevelStyle(levelProps: XmlObject | undefined): PlaceholderTextLevelStyle | null {
		return this.parsePlaceholderLevelStyle(levelProps);
	}
}

describe('parsePlaceholderLevelStyle - bullet colour', () => {
	it('resolves a themed a:schemeClr bullet colour to the theme accent1', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buClr': { 'a:schemeClr': { '@_val': 'accent1' } },
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style).not.toBeNull();
		expect(style?.bulletColor).toBe('#0070C0');
	});

	it('still resolves a plain a:srgbClr bullet colour', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style?.bulletColor).toBe('#FF0000');
	});

	it('resolves an a:sysClr bullet colour via its lastClr', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buClr': { 'a:sysClr': { '@_val': 'windowText', '@_lastClr': '000000' } },
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style?.bulletColor).toBe('#000000');
	});

	it('leaves bulletColor unset when no a:buClr is present', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style?.bulletColor).toBeUndefined();
	});
});
