import { describe, expect, it, vi } from 'vitest';

import { Chart3DSceneMount } from './chart-3d-scene-mount';
import type { Chart3DMountableHandle } from './chart-3d-scene-mount';

interface FakeHandle extends Chart3DMountableHandle {
	id: number;
}

/** A mount fn whose promise resolves only when the test says so. */
function deferredMount(): {
	run: () => Promise<FakeHandle>;
	resolve: (handle: FakeHandle) => void;
	calls: number;
} {
	const pending: Array<(handle: FakeHandle) => void> = [];
	const api = {
		calls: 0,
		run: () =>
			new Promise<FakeHandle>((res) => {
				api.calls += 1;
				pending.push(res);
			}),
		resolve: (handle: FakeHandle) => {
			pending.shift()?.(handle);
		},
	};
	return api;
}

function fakeHandle(id: number, ok = true): FakeHandle {
	return { id, ok, dispose: vi.fn() };
}

const flush = () =>
	new Promise<void>((res) => {
		setTimeout(res, 0);
	});

describe('chart-3d-scene-mount', () => {
	it('mounts once for one options identity and exposes the handle', async () => {
		const onFailed = vi.fn();
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed });
		const scene = deferredMount();
		const opts = {};
		const onMounted = vi.fn();

		mount.ensure(opts, scene.run, onMounted);
		expect(scene.calls).toBe(1);
		expect(mount.handle()).toBeNull();

		const handle = fakeHandle(1);
		scene.resolve(handle);
		await flush();

		expect(mount.handle()).toBe(handle);
		expect(onMounted).toHaveBeenCalledWith(handle);
		expect(onFailed).not.toHaveBeenCalled();
	});

	it('treats an in-flight mount as mounted: a re-fired effect for the same options starts nothing', async () => {
		// The regression: the hand-written mount effects re-ran while the first
		// mount was loading (their `handle` signal was still null), started a
		// second mount for the SAME options, and the second resolved handle
		// replaced the first without disposing it, leaking one WebGL canvas per
		// re-render.
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed: vi.fn() });
		const scene = deferredMount();
		const opts = {};

		mount.ensure(opts, scene.run);
		mount.ensure(opts, scene.run);
		mount.ensure(opts, scene.run);
		expect(scene.calls).toBe(1);

		const handle = fakeHandle(1);
		scene.resolve(handle);
		await flush();
		expect(mount.handle()).toBe(handle);

		// Still mounted: nothing new starts and the live handle survives.
		mount.ensure(opts, scene.run);
		expect(scene.calls).toBe(1);
		expect(handle.dispose).not.toHaveBeenCalled();
	});

	it('disposes a superseded mount on arrival and installs only the newest', async () => {
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed: vi.fn() });
		const scene = deferredMount();
		const first = {};
		const second = {};

		mount.ensure(first, scene.run);
		mount.ensure(second, scene.run);
		expect(scene.calls).toBe(2);

		const staleHandle = fakeHandle(1);
		const liveHandle = fakeHandle(2);
		scene.resolve(staleHandle);
		scene.resolve(liveHandle);
		await flush();

		expect(staleHandle.dispose).toHaveBeenCalledOnce();
		expect(liveHandle.dispose).not.toHaveBeenCalled();
		expect(mount.handle()).toBe(liveHandle);
	});

	it('re-mounting for new options disposes the live scene first', async () => {
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed: vi.fn() });
		const scene = deferredMount();

		mount.ensure({}, scene.run);
		const oldHandle = fakeHandle(1);
		scene.resolve(oldHandle);
		await flush();

		mount.ensure({}, scene.run);
		expect(oldHandle.dispose).toHaveBeenCalledOnce();
		expect(mount.handle()).toBeNull();

		const newHandle = fakeHandle(2);
		scene.resolve(newHandle);
		await flush();
		expect(mount.handle()).toBe(newHandle);
	});

	it('an `ok: false` sentinel is disposed, reported, and never installed', async () => {
		const onFailed = vi.fn();
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed });
		const scene = deferredMount();

		mount.ensure({}, scene.run);
		const sentinel = fakeHandle(1, false);
		scene.resolve(sentinel);
		await flush();

		expect(sentinel.dispose).toHaveBeenCalledOnce();
		expect(onFailed).toHaveBeenCalledOnce();
		expect(mount.handle()).toBeNull();
	});

	it('teardown while a mount is in flight disposes it on arrival', async () => {
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed: vi.fn() });
		const scene = deferredMount();

		mount.ensure({}, scene.run);
		mount.teardown();

		const late = fakeHandle(1);
		scene.resolve(late);
		await flush();

		expect(late.dispose).toHaveBeenCalledOnce();
		expect(mount.handle()).toBeNull();
	});

	it('teardown disposes the live handle and clears it', async () => {
		const mount = new Chart3DSceneMount<object, FakeHandle>({ onFailed: vi.fn() });
		const scene = deferredMount();

		mount.ensure({}, scene.run);
		const handle = fakeHandle(1);
		scene.resolve(handle);
		await flush();

		mount.teardown();
		expect(handle.dispose).toHaveBeenCalledOnce();
		expect(mount.handle()).toBeNull();
	});
});
