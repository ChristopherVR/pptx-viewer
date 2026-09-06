import { describe, expect, it, vi } from 'vitest';

import type { BarChart3DBox } from './bar-chart-3d-layout';
import { buildBarBoxMaterial, createBarChart3DTextureManager } from './bar-chart-3d-materials';
import type { ChartSeriesLike } from './chart-datapoint-style';

/** A texture stand-in that records repeat/wrap assignment and its own dispose. */
class FakeTexture {
	wrapS = 0;
	wrapT = 0;
	repeat = {
		x: 0,
		y: 0,
		set: (x: number, y: number) => (this.repeat.x = x) && (this.repeat.y = y),
	};
	needsUpdate = false;
	dispose = vi.fn();
	clone(): FakeTexture {
		return new FakeTexture();
	}
}

/** Minimal fake `three` exposing only what this module touches. */
function fakeThree(loadBehaviour: 'succeed' | 'fail' = 'succeed') {
	const loadedUrls: string[] = [];
	class TextureLoader {
		load(
			url: string,
			onLoad?: (t: FakeTexture) => void,
			_onProgress?: unknown,
			onError?: (e: unknown) => void,
		) {
			loadedUrls.push(url);
			if (loadBehaviour === 'fail') {
				onError?.(new Error('boom'));
				return;
			}
			onLoad?.(new FakeTexture());
		}
	}
	class MeshPhongMaterial {
		color: string;
		shininess: number;
		map: unknown;
		needsUpdate = false;
		dispose = vi.fn();
		constructor(opts: { color: string; shininess: number }) {
			this.color = opts.color;
			this.shininess = opts.shininess;
		}
	}
	return {
		three: { TextureLoader, MeshPhongMaterial, RepeatWrapping: 1000 },
		loadedUrls,
	};
}

function makeBox(overrides: Partial<BarChart3DBox> = {}): BarChart3DBox {
	return {
		seriesIndex: 0,
		categoryIndex: 0,
		value: 10,
		color: '#4472C4',
		center: [0, 0.5, 0],
		size: [0.4, 1, 0.5],
		...overrides,
	};
}

describe('buildBarBoxMaterial', () => {
	it('builds one plain uniform material when no picture context is given', () => {
		const { three } = fakeThree();
		const result = buildBarBoxMaterial(three as never, makeBox(), undefined);
		expect(Array.isArray(result.material)).toBeFalsy();
		expect(() => result.dispose()).not.toThrow();
	});

	it('builds one plain uniform material when the box has no picture fill at all', () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ color: '#4472C4' }];
		const result = buildBarBoxMaterial(three as never, makeBox(), {
			context: { series },
			textures,
		});
		expect(Array.isArray(result.material)).toBeFalsy();
	});

	it('builds a 6-entry material array when the box has a picture fill', async () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox(), {
			context: { series },
			textures,
		});
		expect(Array.isArray(result.material)).toBeTruthy();
		expect(result.material as unknown[]).toHaveLength(6);
	});

	it('swaps the texture onto the front-face material once the image loads', async () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox(), {
			context: { series },
			textures,
		});
		const materials = result.material as unknown as Array<{ map: unknown }>;
		// posZ (front) is index 4 in three's BoxGeometry face-material order.
		await Promise.resolve();
		await Promise.resolve();
		expect(materials[4].map).toBeInstanceOf(FakeTexture);
	});

	it('two boxes sharing the same imageUrl load the base texture once', async () => {
		const { three, loadedUrls } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'shared.png' } }];
		buildBarBoxMaterial(three as never, makeBox({ categoryIndex: 0 }), {
			context: { series },
			textures,
		});
		buildBarBoxMaterial(three as never, makeBox({ categoryIndex: 0, seriesIndex: 0 }), {
			context: { series },
			textures,
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(loadedUrls.filter((u) => u === 'shared.png')).toHaveLength(1);
	});

	it('does not throw when the image fails to load, and keeps the fallback material', async () => {
		const { three } = fakeThree('fail');
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'missing.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox(), {
			context: { series },
			textures,
		});
		await Promise.resolve();
		await Promise.resolve();
		const materials = result.material as unknown as Array<{ map: unknown; dispose: () => void }>;
		expect(materials[4].map).toBeUndefined();
		expect(() => result.dispose()).not.toThrow();
	});

	it('disposing before the texture resolves disposes the late-arriving clone instead of assigning it', async () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox(), {
			context: { series },
			textures,
		});
		result.dispose();
		await Promise.resolve();
		await Promise.resolve();
		const materials = result.material as unknown as Array<{ map: unknown }>;
		expect(materials[4].map).toBeUndefined();
	});
});

describe('buildBarBoxMaterial - round shapes (cylinder/cone/pyramid)', () => {
	it('builds one plain uniform material for a picture-bearing cylinder with no applyTo* flags off (no lateral/end distinction while all colours match)', () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ color: '#4472C4' }];
		const result = buildBarBoxMaterial(three as never, makeBox({ shape: 'cylinder' }), {
			context: { series },
			textures,
		});
		expect(Array.isArray(result.material)).toBeFalsy();
	});

	it('builds a 3-entry material array (side, end/top, bottom) for a picture-filled cylinder', () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'cyl.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox({ shape: 'cylinder' }), {
			context: { series },
			textures,
		});
		expect(Array.isArray(result.material)).toBeTruthy();
		expect(result.material as unknown[]).toHaveLength(3);
	});

	it('swaps the texture onto the lateral (side, index 0) material once the image loads', async () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'cyl.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox({ shape: 'cylinder' }), {
			context: { series },
			textures,
		});
		const materials = result.material as unknown as Array<{ map: unknown }>;
		await Promise.resolve();
		await Promise.resolve();
		expect(materials[0].map).toBeInstanceOf(FakeTexture);
	});

	it('a full cone/pyramid (no top cap) still builds a 3-entry array; the unused end/top material is harmless', () => {
		const { three } = fakeThree();
		const textures = createBarChart3DTextureManager(three as never);
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'cone.png' } }];
		const result = buildBarBoxMaterial(three as never, makeBox({ shape: 'cone' }), {
			context: { series },
			textures,
		});
		expect(result.material as unknown[]).toHaveLength(3);
		expect(() => result.dispose()).not.toThrow();
	});
});

describe('createBarChart3DTextureManager', () => {
	it('disposeAll disposes every loaded base texture', async () => {
		const { three } = fakeThree();
		const manager = createBarChart3DTextureManager(three as never);
		const texture = await manager.load('a.png');
		manager.disposeAll();
		expect((texture as unknown as FakeTexture).dispose).toHaveBeenCalledOnce();
	});
});
