import { describe, expect, it } from 'vitest';

import { COM_AVLST_GROUND_TRUTH } from './com-avlst-ground-truth';
import { PRESET_SHAPE_GEOMETRY_TABLE } from './preset-shape-definitions-table';

describe('preset avLst vs PowerPoint COM ground truth', () => {
	for (const entry of COM_AVLST_GROUND_TRUTH) {
		it(`${entry.prst}: has exactly the COM-verified guide count/names/defaults`, () => {
			const def = PRESET_SHAPE_GEOMETRY_TABLE[entry.prst];
			expect(def, `${entry.prst} missing from PRESET_SHAPE_GEOMETRY_TABLE`).toBeDefined();
			const avLst = def?.avLst ?? {};
			const actualNames = Object.keys(avLst).sort();
			const expectedNames = Object.keys(entry.guides).sort();
			expect(actualNames, `${entry.prst} guide names`).toStrictEqual(expectedNames);
			expect(actualNames, `${entry.prst} guide count`).toHaveLength(entry.count);
			for (const [name, value] of Object.entries(entry.guides)) {
				expect(avLst[name], `${entry.prst}.avLst.${name}`).toBe(value);
			}
		});
	}
});
