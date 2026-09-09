import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseSmartArtPresLayoutVars } from './smartart-pres-layout-vars';

describe('parseSmartArtPresLayoutVars', () => {
	it('returns undefined for an undefined container', () => {
		expect(parseSmartArtPresLayoutVars(undefined)).toBeUndefined();
	});

	it('returns undefined when no vars element is present', () => {
		expect(parseSmartArtPresLayoutVars({ 'dgm:ptLst': {} })).toBeUndefined();
	});

	it('parses dir + orgChart from a data-model prSet/presLayoutVars', () => {
		const dataModel: XmlObject = {
			'dgm:ptLst': {
				'dgm:pt': {
					'@_type': 'doc',
					'dgm:prSet': {
						'dgm:presLayoutVars': {
							'dgm:dir': { '@_val': 'rev' },
							'dgm:orgChart': { '@_val': '1' },
						},
					},
				},
			},
		};
		const vars = parseSmartArtPresLayoutVars(dataModel);
		expect(vars).toBeDefined();
		expect(vars!.direction).toBe('rev');
		expect(vars!.orgChart).toBeTruthy();
	});

	it('parses hierBranch, child counts and bullets from a layout varLst', () => {
		const layoutDef: XmlObject = {
			'dgm:varLst': {
				'dgm:hierBranch': { '@_val': 'init' },
				'dgm:chMax': { '@_val': '4' },
				'dgm:chPref': { '@_val': '-1' },
				'dgm:bulletEnabled': { '@_val': 'true' },
			},
		};
		const vars = parseSmartArtPresLayoutVars(layoutDef)!;
		expect(vars.hierarchyBranch).toBe('init');
		expect(vars.childMax).toBe(4);
		expect(vars.childPreferred).toBe(-1);
		expect(vars.bulletEnabled).toBeTruthy();
		expect(vars.direction).toBeUndefined();
	});

	it('ignores unrecognised direction / hierBranch enum values', () => {
		const vars = parseSmartArtPresLayoutVars({
			'dgm:varLst': {
				'dgm:dir': { '@_val': 'sideways' },
				'dgm:bulletEnabled': { '@_val': '0' },
			},
		});
		expect(vars).toBeDefined();
		expect(vars!.direction).toBeUndefined();
		expect(vars!.bulletEnabled).toBeFalsy();
	});

	it('returns a defined (empty) object for a bare <dgm:dir/> with no @val, not undefined', () => {
		// `bending-picture-caption--hier5.pptx`'s cached `diagram` pres point
		// declares exactly `<dgm:presLayoutVars><dgm:dir/></dgm:presLayoutVars>`
		// (present, but valueless): `smartart-layout-interpreter-when.ts`'s
		// `evaluateVar` can only apply its OWN `dir="norm"` spec default to a
		// variable that resolves to `undefined` WITHIN a defined
		// `presLayoutVars` object - collapsing this to `undefined` entirely
		// made every `dgm:if func="var" arg="dir"` choose gating the diagram's
		// primary arrangement undecidable, so `discoverArrangement` fell back
		// to a single-leaf `tx` approximation instead of running `snake`
		// (measured: 5 flat grid boxes instead of 3, one per top-level node).
		const vars = parseSmartArtPresLayoutVars({
			'dgm:ptLst': {
				'dgm:pt': {
					'@_type': 'doc',
					'dgm:prSet': {
						'dgm:presLayoutVars': { 'dgm:dir': '' },
					},
				},
			},
		});
		expect(vars).toBeDefined();
		expect(vars).toStrictEqual({});
		expect(vars!.direction).toBeUndefined();
	});
});
