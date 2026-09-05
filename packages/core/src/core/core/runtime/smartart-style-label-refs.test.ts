import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import type { SmartArtStyleLabelThemeDeps } from './smartart-style-label-refs';
import { buildSmartArtQuickStyle } from './smartart-style-label-refs';

const localName = (key: string): string => key.split(':').pop() ?? key;

/**
 * A fake theme resolver bundle standing in for
 * `PptxHandlerRuntimeThemeRefResolution.ts`'s real methods: it mimics
 * resolving `@_idx="1"` to a fixed theme accent colour, exactly the shape a
 * real `fmtScheme` lookup would produce.
 */
function fakeDeps(): SmartArtStyleLabelThemeDeps {
	return {
		resolveThemeFillRef: (refNode, style) => {
			if (String(refNode['@_idx'] ?? '') === '1') {
				style.fillMode = 'solid';
				style.fillColor = '#4F81BD';
			}
		},
		resolveThemeLineRef: (refNode, style) => {
			if (String(refNode['@_idx'] ?? '') === '2') {
				style.strokeColor = '#2E5B8A';
				style.strokeWidth = 1.5;
			}
		},
		resolveThemeEffectRef: (refNode, style) => {
			if (String(refNode['@_idx'] ?? '') === '1') {
				style.shadowColor = '#00000080';
			}
		},
		resolveThemeTypeface: (typeface) => (typeface === '+mn-lt' ? 'Calibri' : undefined),
	};
}

function styleLbl(name: string, style: XmlObject): XmlObject {
	return { '@_name': name, 'dgm:style': style };
}

/** Build a `dgm:styleDef` XML element (and its raw `styleLbl` list) from label fixtures. */
function styleDef(styleLbls: XmlObject[]): { def: XmlObject; styleLbls: XmlObject[] } {
	return { def: { '@_uniqueId': 'urn:test', 'dgm:styleLbl': styleLbls }, styleLbls };
}

// G13: `dgm:styleLbl` quick-style refs resolve against the theme's fmtScheme
// instead of the coarse subtle/moderate/intense enum.
describe('buildSmartArtQuickStyle', () => {
	it('resolves fillRef/lnRef/effectRef/fontRef onto the matching label', () => {
		const { def, styleLbls } = styleDef([
			styleLbl('node1', {
				'a:fillRef': { '@_idx': '1' },
				'a:lnRef': { '@_idx': '2' },
				'a:effectRef': { '@_idx': '1' },
				'a:fontRef': { '@_idx': 'minor' },
			}),
		]);
		const quickStyle = buildSmartArtQuickStyle(def, localName, styleLbls, fakeDeps());
		const label = quickStyle.labels?.find((entry) => entry.name === 'node1');
		expect(label?.resolvedStyle).toStrictEqual({
			fillColor: '#4F81BD',
			fillMode: 'solid',
			strokeColor: '#2E5B8A',
			strokeWidth: 1.5,
			shadowColor: '#00000080',
			fontTypeface: 'Calibri',
		});
	});

	it('leaves a label with no dgm:style refs untouched (no resolvedStyle)', () => {
		const { def, styleLbls } = styleDef([styleLbl('bgShp', {})]);
		const quickStyle = buildSmartArtQuickStyle(def, localName, styleLbls, fakeDeps());
		expect(quickStyle.labels?.find((entry) => entry.name === 'bgShp')).toStrictEqual({
			name: 'bgShp',
		});
	});

	it('omits resolvedStyle when the deps resolve nothing (idx not in the fake theme)', () => {
		const { def, styleLbls } = styleDef([styleLbl('node1', { 'a:fillRef': { '@_idx': '99' } })]);
		const quickStyle = buildSmartArtQuickStyle(def, localName, styleLbls, fakeDeps());
		expect(
			quickStyle.labels?.find((entry) => entry.name === 'node1')?.resolvedStyle,
		).toBeUndefined();
	});

	it('still computes effectIntensity alongside resolvedStyle (backward compatible)', () => {
		const { def, styleLbls } = styleDef([
			styleLbl('node1', { 'a:fillRef': { '@_idx': '3' }, 'a:effectRef': { '@_idx': '2' } }),
		]);
		const quickStyle = buildSmartArtQuickStyle(def, localName, styleLbls, fakeDeps());
		expect(quickStyle.effectIntensity).toBe('intense');
	});

	it('matches labels to their raw dgm:style by name, not position', () => {
		const { def, styleLbls } = styleDef([
			styleLbl('asst0', {}),
			styleLbl('node1', { 'a:fillRef': { '@_idx': '1' } }),
		]);
		const quickStyle = buildSmartArtQuickStyle(def, localName, styleLbls, fakeDeps());
		expect(
			quickStyle.labels?.find((entry) => entry.name === 'asst0')?.resolvedStyle,
		).toBeUndefined();
		expect(
			quickStyle.labels?.find((entry) => entry.name === 'node1')?.resolvedStyle?.fillColor,
		).toBe('#4F81BD');
	});
});
