import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { resolveSmartArtEffectIntensity } from './smartart-effect-intensity';

const localName = (key: string): string => key.split(':').pop() ?? key;

/**
 * Shape of `dgm:styleLbl name="node1"` as it actually appears in
 * `e2e/fixtures/animation-builds-color.pptx` and
 * `packages/core/src/__tests__/fixtures/corpus/smartart-chart-table-mix.pptx`
 * (`ppt/diagrams/quickStyle1.xml` .. `quickStyle4.xml`): structurally-named
 * labels (`node0`..`node4`, `asst0`..`asst4`, ...) with an empty `dgm:sp3d`
 * marker and `lnRef idx="2"` / `fillRef idx="1"` / `effectRef idx="0"`.
 */
function realFixtureNodeLabel(name: string): XmlObject {
	return {
		'@_name': name,
		'dgm:scene3d': {
			'a:camera': { '@_prst': 'orthographicFront' },
			'a:lightRig': { '@_rig': 'threePt', '@_dir': 't' },
		},
		'dgm:sp3d': '',
		'dgm:txPr': '',
		'dgm:style': {
			'a:lnRef': { '@_idx': '2', 'a:scrgbClr': { '@_r': '0', '@_g': '0', '@_b': '0' } },
			'a:fillRef': { '@_idx': '1', 'a:scrgbClr': { '@_r': '0', '@_g': '0', '@_b': '0' } },
			'a:effectRef': { '@_idx': '0', 'a:scrgbClr': { '@_r': '0', '@_g': '0', '@_b': '0' } },
			'a:fontRef': { '@_idx': 'minor', 'a:schemeClr': { '@_val': 'lt1' } },
		},
	};
}

describe('resolveSmartArtEffectIntensity', () => {
	it('never fires the old name-substring heuristic on real quickStyle label names', () => {
		// The audit's claim under test: real quickStyle*.xml files never name a
		// styleLbl "intense"/"3d"/"moderate"/"subtle"/"flat" - every label in
		// both real fixtures is a structural name (node0, asst1, bgShp, revTx,
		// parChTrans1D2, ...). Confirms replacing the heuristic was warranted.
		const realLabelNames = [
			'alignAcc1',
			'asst0',
			'asst1',
			'bgShp',
			'callout',
			'fgAcc0',
			'lnNode1',
			'node0',
			'node1',
			'node2',
			'parChTrans1D1',
			'revTx',
			'sibTrans1D1',
			'vennNode1',
		];
		for (const name of realLabelNames) {
			expect(/intense|3d|moderate|semi|subtle|flat/iu.test(name)).toBeFalsy();
		}
	});

	it('resolves "subtle" from the real fixture styleLbl shape (idx 0/1, empty sp3d)', () => {
		const styleLbls = [
			realFixtureNodeLabel('node0'),
			realFixtureNodeLabel('node1'),
			realFixtureNodeLabel('node2'),
		];
		expect(resolveSmartArtEffectIntensity(styleLbls, localName)).toBe('subtle');
	});

	it('prefers "node1" over other node<N> labels when several are present', () => {
		const node0 = realFixtureNodeLabel('node0');
		const node1 = { ...realFixtureNodeLabel('node1'), 'dgm:sp3d': { 'a:bevelT': {} } };
		expect(resolveSmartArtEffectIntensity([node0, node1], localName)).toBe('intense');
	});

	it('returns undefined when no node<N> styleLbl is present', () => {
		const styleLbls = [realFixtureNodeLabel('bgShp'), realFixtureNodeLabel('revTx')];
		expect(resolveSmartArtEffectIntensity(styleLbls, localName)).toBeUndefined();
	});

	// The remaining cases below have no real fixture in this repo (every real
	// quickStyle*.xml here only exercises the "subtle" shape): they are
	// hand-built to match how PowerPoint's genuine "Intense Effect" and
	// "Moderate Effect" quick styles vary `dgm:sp3d` / `a:effectRef`/`a:fillRef`
	// idx, per ECMA-376's CT_Shape3D / CT_StyleMatrixReference.

	it('resolves "intense" from real bevel geometry inside dgm:sp3d', () => {
		const label = {
			...realFixtureNodeLabel('node1'),
			'dgm:sp3d': {
				'a:bevelT': { '@_w': '38100', '@_h': '38100' },
			},
		};
		expect(resolveSmartArtEffectIntensity([label], localName)).toBe('intense');
	});

	it('resolves "intense" from a high effectRef index with no bevel geometry', () => {
		const label = realFixtureNodeLabel('node1');
		(label['dgm:style'] as XmlObject)['a:effectRef'] = { '@_idx': '2' };
		expect(resolveSmartArtEffectIntensity([label], localName)).toBe('intense');
	});

	it('resolves "moderate" from a mid effectRef index with no bevel geometry', () => {
		const label = realFixtureNodeLabel('node1');
		(label['dgm:style'] as XmlObject)['a:effectRef'] = { '@_idx': '1' };
		expect(resolveSmartArtEffectIntensity([label], localName)).toBe('moderate');
	});
});
