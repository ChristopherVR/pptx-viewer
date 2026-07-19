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
});
