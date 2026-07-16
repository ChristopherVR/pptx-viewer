import type { Model3DPptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { collectImagePaths } from './load-content-helpers';

describe('collectImagePaths model3d assets', () => {
	it('collects the model payload and poster for lazy resolution', () => {
		const model: Model3DPptxElement = {
			id: 'model-1',
			type: 'model3d',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			modelPath: 'ppt/media/model1.glb',
			modelMimeType: 'model/gltf-binary',
			imagePath: 'ppt/media/model1.png',
			posterImage: 'ppt/media/model1.png',
		};
		const slides = [{ id: 'slide-1', elements: [model] }] as PptxSlide[];

		const result = collectImagePaths(slides);

		expect([...result.paths]).toStrictEqual(['ppt/media/model1.glb', 'ppt/media/model1.png']);
		expect(result.refs.map(({ field, path }) => ({ field, path }))).toStrictEqual([
			{ field: 'modelData', path: 'ppt/media/model1.glb' },
			{ field: 'posterImage', path: 'ppt/media/model1.png' },
		]);
	});

	it('does not collect already resolved or external model assets', () => {
		const model = {
			id: 'model-2',
			type: 'model3d',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			modelPath: 'https://example.test/model.glb',
			modelData: 'data:model/gltf-binary;base64,AAAA',
			imagePath: 'ppt/media/model2.png',
			imageData: 'blob:poster',
		} as Model3DPptxElement;
		const slides = [{ id: 'slide-2', elements: [model] }] as PptxSlide[];

		expect(collectImagePaths(slides)).toStrictEqual({ paths: new Set(), refs: [] });
	});
});
