/**
 * Round-trip tests for the typed chart manual-layout helpers, including the
 * CT_ManualLayout `c:extLst` capture/emit path that keeps extension content in
 * the typed model instead of dropping it during a dirty write.
 */

import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartManualLayout, parseChartManualLayout } from './chart-layout';

// Local-name resolver mirroring the runtime compatibility service: strip any
// namespace prefix (`c:x` -> `x`).
const localName = (key: string): string => (key.includes(':') ? key.split(':').pop()! : key);

function layoutParent(manual: XmlObject): XmlObject {
	return { 'c:layout': { 'c:manualLayout': manual } };
}

describe('chart manual layout helpers', () => {
	it('parses the typed manual-layout fields', () => {
		const parent = layoutParent({
			'c:layoutTarget': { '@_val': 'inner' },
			'c:xMode': { '@_val': 'edge' },
			'c:x': { '@_val': '0.25' },
			'c:w': { '@_val': '0.5' },
		});
		const layout = parseChartManualLayout(parent, localName);
		expect(layout).toStrictEqual({ layoutTarget: 'inner', xMode: 'edge', x: 0.25, width: 0.5 });
	});

	it('round-trips the manual layout extension list through the typed model', () => {
		const ext: XmlObject = {
			'c:ext': { '@_uri': '{vendor-guid}', 'c16:uniqueId': { '@_val': '42' } },
		};
		const parent = layoutParent({
			'c:x': { '@_val': '0.1' },
			'c:extLst': ext,
		});

		// Parse lifts the extLst into the typed model rather than leaving it as
		// opaque sibling XML.
		const layout = parseChartManualLayout(parent, localName);
		expect(layout?.ext).toStrictEqual(ext);

		// A dirty write of the edited layout re-emits the captured extension list
		// instead of dropping it, and keeps it as the trailing child (schema
		// order: positional fields, then extLst).
		const edited = { ...layout!, x: 0.2 };
		const target = layoutParent({ 'c:x': { '@_val': '0.1' }, 'c:extLst': ext });
		applyChartManualLayout(target, edited, localName);
		const manual = (target['c:layout'] as XmlObject)['c:manualLayout'] as XmlObject;
		expect(manual['c:extLst']).toStrictEqual(ext);
		const keys = Object.keys(manual);
		expect(keys.indexOf('c:extLst')).toBe(keys.length - 1);
		expect((manual['c:x'] as XmlObject)['@_val']).toBe('0.2');
	});

	it('omits the extension list when the typed layout has none', () => {
		const target = layoutParent({});
		applyChartManualLayout(target, { x: 0.3 }, localName);
		const manual = (target['c:layout'] as XmlObject)['c:manualLayout'] as XmlObject;
		expect('c:extLst' in manual).toBeFalsy();
		expect((manual['c:x'] as XmlObject)['@_val']).toBe('0.3');
	});
});
