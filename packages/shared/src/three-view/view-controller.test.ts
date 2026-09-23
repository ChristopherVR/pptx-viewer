// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThreeViewScene, ThreeViewSpec, ThreeViewState } from './types';

const hostMock = vi.hoisted(() => ({
	available: true,
	register: vi.fn(),
	unregister: vi.fn(),
	requestRender: vi.fn(),
	flushNow: vi.fn(),
}));
const factoryMock = vi.hoisted(() => vi.fn());

vi.mock(import('../render/chart-3d-three-loader'), () => ({
	loadChart3DThree: async () => ({}),
	loadChart3DOrbitControls: async () => null,
}));
vi.mock(import('./renderer-host'), () => ({
	MAX_VIEW_PIXELS: 4096,
	getThreeRendererHost: () => hostMock,
}));
vi.mock(import('./scene-registry'), () => ({
	loadThreeViewScene: async () => factoryMock,
}));

const { ThreeViewController } = await import('./view-controller');

function makeScene(): ThreeViewScene {
	return { render: vi.fn(), resize: vi.fn(), dispose: vi.fn(), setSelectedPart: vi.fn() };
}

function makeController() {
	const states: ThreeViewState[] = [];
	const overlay = document.createElement('div');
	const controller = new ThreeViewController({
		canvas: document.createElement('canvas'),
		overlay,
		eventTarget: document.createElement('div'),
		measure: () => ({ width: 100, height: 50, pixelWidth: 100, pixelHeight: 50 }),
		isVisible: () => true,
		onState: (s) => states.push(s),
		onSceneEvent: () => {},
	});
	return { controller, states, overlay };
}

const spec = (id: string): ThreeViewSpec =>
	({ kind: 'smartart', spec: { id } }) as unknown as ThreeViewSpec;

afterEach(() => {
	vi.clearAllMocks();
	factoryMock.mockReset();
	hostMock.available = true;
});

describe('three view controller', () => {
	it('mounts a scene, registers it and reports ready', async () => {
		const scene = makeScene();
		factoryMock.mockResolvedValue(scene);
		const { controller, states, overlay } = makeController();
		await controller.setSpec(spec('a'));
		expect(states).toStrictEqual(['loading', 'ready']);
		expect(hostMock.register).toHaveBeenCalledOnce();
		expect(overlay.childElementCount).toBe(1);
		expect(scene.setSelectedPart).toHaveBeenCalledWith(null);
	});

	it('reports unavailable when WebGL cannot start', async () => {
		hostMock.available = false;
		const { controller, states } = makeController();
		await controller.setSpec(spec('a'));
		expect(states).toStrictEqual(['loading', 'unavailable']);
		expect(factoryMock).not.toHaveBeenCalled();
	});

	it('shows the fallback when the scene throws', async () => {
		factoryMock.mockRejectedValue(new Error('bad deck'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { controller, states } = makeController();
		await controller.setSpec(spec('a'));
		expect(states.at(-1)).toBe('error');
		warn.mockRestore();
	});

	it('drops a stale mount before it reaches the scene factory', async () => {
		factoryMock.mockResolvedValue(makeScene());
		const { controller } = makeController();
		const first = controller.setSpec(spec('old'));
		await controller.setSpec(spec('new'));
		await first;
		expect(factoryMock).toHaveBeenCalledOnce();
		expect(hostMock.register).toHaveBeenCalledOnce();
	});

	it('discards a mount that a newer spec overtook', async () => {
		const slow = makeScene();
		const fast = makeScene();
		let release: (s: ThreeViewScene) => void = () => {};
		factoryMock
			.mockImplementationOnce(
				() =>
					new Promise<ThreeViewScene>((r) => {
						release = r;
					}),
			)
			.mockResolvedValueOnce(fast);
		const { controller } = makeController();
		const first = controller.setSpec(spec('old'));
		// Let the first mount reach its (slow) scene factory before overtaking it.
		await vi.waitFor(() => expect(factoryMock).toHaveBeenCalledOnce());
		await controller.setSpec(spec('new'));
		release(slow);
		await first;
		expect(slow.dispose).toHaveBeenCalledOnce();
		expect(fast.dispose).not.toHaveBeenCalled();
		expect(hostMock.register).toHaveBeenCalledOnce();
	});

	it('keeps the old scene on screen until its replacement is ready, then disposes it', async () => {
		const first = makeScene();
		const second = makeScene();
		factoryMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const { controller, states, overlay } = makeController();
		await controller.setSpec(spec('a'));
		await controller.setSpec(spec('b'));
		expect(states).toStrictEqual(['loading', 'ready', 'ready']);
		expect(first.dispose).toHaveBeenCalledOnce();
		expect(overlay.childElementCount).toBe(1);
	});
});
