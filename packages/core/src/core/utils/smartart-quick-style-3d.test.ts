import { describe, expect, it } from 'vitest';

import type {
	Pptx3DScene,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	PptxSmartArtQuickStyle,
} from '../types';
import {
	applySmartArtQuickStyle3d,
	isDefaultSmartArtLabelScene,
	smartArtQuickStyleHas3d,
} from './smartart-quick-style-3d';

const DEFAULT_SCENE: Pptx3DScene = {
	cameraPreset: 'orthographicFront',
	lightRigType: 'threePt',
	lightRigDirection: 't',
};
const FLAT_RIG_SCENE: Pptx3DScene = { ...DEFAULT_SCENE, lightRigType: 'flat' };

function shape(id: string): PptxSmartArtDrawingShape {
	return { id, shapeType: 'rect', x: 0, y: 0, width: 10, height: 10 };
}

const bevelStyle: PptxSmartArtQuickStyle = {
	labels: [
		{
			name: 'node1',
			scene3d: FLAT_RIG_SCENE,
			shape3d: { presetMaterial: 'plastic', bevelTopType: 'circle', bevelTopWidth: 120900 },
		},
		{ name: 'revTx', scene3d: DEFAULT_SCENE },
		{ name: 'node2', scene3d: DEFAULT_SCENE, shape3d: { extrusionHeight: 5 } },
	],
};

describe('isDefaultSmartArtLabelScene', () => {
	it('treats the front camera + top threePt light as default', () => {
		expect(isDefaultSmartArtLabelScene(DEFAULT_SCENE)).toBeTruthy();
		expect(isDefaultSmartArtLabelScene(FLAT_RIG_SCENE)).toBeFalsy();
		expect(isDefaultSmartArtLabelScene({ ...DEFAULT_SCENE, lightRigRotZ: 7500000 })).toBeFalsy();
		expect(isDefaultSmartArtLabelScene({ ...DEFAULT_SCENE, cameraRotX: 0 })).toBeFalsy();
	});
});

describe('applySmartArtQuickStyle3d', () => {
	it('is a no-op for a flat quick style', () => {
		const shapes = [shape('sa-interp-a')];
		const flat: PptxSmartArtQuickStyle = { labels: [{ name: 'node1', scene3d: DEFAULT_SCENE }] };
		expect(smartArtQuickStyleHas3d(flat)).toBeFalsy();
		expect(applySmartArtQuickStyle3d(shapes, { nodes: [], quickStyle: flat })).toBe(shapes);
	});

	it("keys each shape by its node's style label; a new node inherits a sibling's", () => {
		const nodes: PptxSmartArtNode[] = [
			{ id: 'a', text: 'A', parentId: 'root', styleRole: 'node1' },
			{ id: 'b', text: 'B', parentId: 'root' },
			{ id: 'c', text: 'C', parentId: 'a', styleRole: 'revTx' },
			{ id: 'd', text: 'D', parentId: 'a', styleRole: 'node2' },
		];
		const out = applySmartArtQuickStyle3d(
			[shape('sa-interp-a'), shape('sa-interp-b'), shape('sa-interp-c'), shape('sa-interp-d')],
			{ nodes, quickStyle: bevelStyle },
		);
		expect(out[0].scene3d).toStrictEqual(FLAT_RIG_SCENE);
		expect(out[0].shape3d?.bevelTopWidth).toBe(120900);
		expect(out[1].shape3d).toStrictEqual(out[0].shape3d);
		// revTx: default scene and no sp3d, so the text-only shape stays flat.
		expect(out[2].scene3d).toBeUndefined();
		expect(out[2].shape3d).toBeUndefined();
		// A default label scene is never written onto the shape.
		expect(out[3].scene3d).toBeUndefined();
		expect(out[3].shape3d).toStrictEqual({ extrusionHeight: 5 });
	});

	it('falls back to node1 for an unmatched shape and keeps existing 3D', () => {
		const own = { presetMaterial: 'metal' };
		const out = applySmartArtQuickStyle3d([shape('sa-interp-1'), { ...shape('x'), shape3d: own }], {
			nodes: [],
			quickStyle: bevelStyle,
		});
		expect(out[0].shape3d?.presetMaterial).toBe('plastic');
		expect(out[1].shape3d).toBe(own);
		expect(out[1].scene3d).toStrictEqual(FLAT_RIG_SCENE);
	});
});
