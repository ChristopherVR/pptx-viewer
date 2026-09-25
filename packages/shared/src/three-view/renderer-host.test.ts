import { afterEach, describe, expect, it, vi } from 'vitest';

import { getThreeRendererHost, resetThreeRendererHostForTests } from './renderer-host';
import type { HostedView } from './renderer-host';
import type { ThreeModule } from './types';

interface FakeRenderer {
	domElement: { addEventListener: () => void };
	viewports: Array<[number, number, number, number]>;
	sizes: Array<[number, number]>;
	setPixelRatio: () => void;
	setSize: (w: number, h: number) => void;
	setViewport: (x: number, y: number, w: number, h: number) => void;
	setScissor: () => void;
	setScissorTest: () => void;
	setClearColor: () => void;
	clear: () => void;
	outputColorSpace: string;
	autoClear: boolean;
	options: Record<string, unknown>;
}

let created: FakeRenderer[] = [];

function fakeThree(): ThreeModule {
	class WebGLRenderer implements FakeRenderer {
		domElement = { addEventListener: () => {} };
		viewports: Array<[number, number, number, number]> = [];
		sizes: Array<[number, number]> = [];
		outputColorSpace = '';
		autoClear = true;
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown> = {}) {
			this.options = options;
			created.push(this);
		}
		setPixelRatio(): void {}
		setSize(w: number, h: number): void {
			this.sizes.push([w, h]);
		}
		setViewport(x: number, y: number, w: number, h: number): void {
			this.viewports.push([x, y, w, h]);
		}
		setScissor(): void {}
		setScissorTest(): void {}
		setClearColor(): void {}
		clear(): void {}
	}
	return { WebGLRenderer, SRGBColorSpace: 'srgb' } as unknown as ThreeModule;
}

function fakeView(width: number, height: number, overrides: Partial<HostedView> = {}) {
	const drawImage = vi.fn();
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ({ clearRect: () => {}, drawImage }),
	} as unknown as HTMLCanvasElement;
	const draw = vi.fn();
	const view: HostedView = {
		canvas,
		pixelSize: () => ({ width, height }),
		isVisible: () => true,
		draw,
		isAnimating: () => false,
		...overrides,
	};
	return { view, draw, drawImage, canvas };
}

afterEach(() => {
	resetThreeRendererHostForTests();
	created = [];
});

describe('three renderer host', () => {
	it('shares ONE renderer across every view', () => {
		const host = getThreeRendererHost(fakeThree());
		for (let i = 0; i < 40; i++) {
			host.register(fakeView(100, 50).view);
		}
		expect(getThreeRendererHost(fakeThree())).toBe(host);
		expect(created).toHaveLength(1);
	});

	it('declares its buffer premultiplied (an antialiased edge resolves premultiplied)', () => {
		getThreeRendererHost(fakeThree()).register(fakeView(100, 50).view);
		expect(created[0].options).toMatchObject({ alpha: true, antialias: true });
		expect(created[0].options.premultipliedAlpha ?? true).toBeTruthy();
	});

	it('draws each dirty view once and copies it to the view canvas', () => {
		const host = getThreeRendererHost(fakeThree());
		const a = fakeView(200, 100);
		const b = fakeView(80, 40);
		host.register(a.view);
		host.register(b.view);
		host.flushNow();
		expect(a.draw).toHaveBeenCalledOnce();
		expect(b.draw).toHaveBeenCalledOnce();
		expect(a.canvas.width).toBe(200);
		expect(b.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 80, 40, 0, 0, 80, 40);
		// Nothing changed: a second flush draws nothing.
		host.flushNow();
		expect(a.draw).toHaveBeenCalledOnce();
	});

	it('anchors each view at the top of the shared buffer', () => {
		const host = getThreeRendererHost(fakeThree());
		host.register(fakeView(300, 200).view);
		host.register(fakeView(100, 50).view);
		host.flushNow();
		const renderer = created[0];
		// Buffer grew to 300x200; the 100x50 view sits at y = 200 - 50.
		expect(renderer.viewports).toContainEqual([0, 150, 100, 50]);
	});

	it('keeps drawing animating views and skips hidden ones until visible', () => {
		const host = getThreeRendererHost(fakeThree());
		let visible = false;
		const hidden = fakeView(50, 50, { isVisible: () => visible });
		const spinning = fakeView(50, 50, { isAnimating: () => true });
		host.register(hidden.view);
		host.register(spinning.view);
		host.flushNow();
		host.flushNow();
		expect(hidden.draw).not.toHaveBeenCalled();
		expect(spinning.draw).toHaveBeenCalledTimes(2);
		visible = true;
		host.flushNow();
		expect(hidden.draw).toHaveBeenCalledOnce();
	});

	it('keeps drawing other views when one scene throws', () => {
		const host = getThreeRendererHost(fakeThree());
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = fakeView(50, 50, {
			draw: () => {
				throw new Error('boom');
			},
		});
		const fine = fakeView(50, 50);
		host.register(broken.view);
		host.register(fine.view);
		host.flushNow();
		expect(fine.draw).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('forgets unregistered views', () => {
		const host = getThreeRendererHost(fakeThree());
		const v = fakeView(50, 50);
		host.register(v.view);
		host.unregister(v.view);
		host.requestRender(v.view);
		host.flushNow();
		expect(v.draw).not.toHaveBeenCalled();
	});
});
