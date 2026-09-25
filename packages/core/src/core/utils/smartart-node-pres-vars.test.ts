import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { resolveSmartArtNodePresVars } from './smartart-node-pres-vars';

const localName = (key: string): string => key.slice(key.indexOf(':') + 1);

describe('resolveSmartArtNodePresVars', () => {
	it("keys each presentation point's variables by its content node and presName", () => {
		const points: XmlObject[] = [
			{ '@_modelId': 'n1', '@_type': 'node' },
			{
				'@_modelId': 'p1',
				'@_type': 'pres',
				'dgm:prSet': {
					'@_presAssocID': 'n1',
					'@_presName': 'hierRoot1',
					'dgm:presLayoutVars': { 'dgm:hierBranch': { '@_val': 'l' }, 'dgm:dir': {} },
				},
			},
			{
				'@_modelId': 'p2',
				'@_type': 'pres',
				'dgm:prSet': { '@_presAssocID': 'n1', '@_presName': 'rootComposite1' },
			},
		];
		const vars = resolveSmartArtNodePresVars(points, localName);
		expect(vars.get('n1')).toStrictEqual({ hierRoot1: { hierBranch: 'l' } });
	});
});
