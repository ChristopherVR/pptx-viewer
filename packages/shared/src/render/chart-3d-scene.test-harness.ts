/**
 * Test-only harness: mounts a hosted perspective chart scene (bar/line/area/
 * pie/surface `create*Chart3DScene`) against a fake `<pptx-three-view>`
 * context, so the scene suites can keep asserting on a container, a canvas
 * and the select/drag callbacks exactly as they did before the scenes moved
 * onto the shared renderer. Relies on the suite's own `vi.mock` of `three`
 * and its OrbitControls addon.
 *
 * @module chart-3d-scene.test-harness
 */
import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type { ChartPartRef } from './chart-view-model';

/** The select/drag callbacks the pre-host `mount*Chart3D` functions took. */
export interface TestChart3DInteraction {
	onSelect?: (part: ChartPartRef | null) => void;
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/** What a mounted test scene exposes. */
export interface TestChart3DHandle {
	readonly ok: true;
	scene: ThreeViewScene;
	canvas: HTMLCanvasElement;
	render: () => void;
	resize: (width: number, height: number) => void;
	setSelectedPart: (part: ChartPartRef | null) => void;
	setTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
	setInteractive: (on: boolean) => void;
	dispose: () => void;
}

interface TestContainer {
	ownerDocument?: unknown;
	appendChild: (child: unknown) => void;
}

/**
 * Mount `factory` into `container`: the fake canvas (from the mocked
 * `WebGLRenderer`) is appended first, then the scene's label overlay, so
 * `container.children[0]` is still the canvas.
 */
export async function mountHostedChart3DForTest<O extends { width: number; height: number }>(
	factory: (ctx: ThreeViewContext, options: O) => ThreeViewScene,
	container: TestContainer,
	options: O,
	interaction?: TestChart3DInteraction,
	interactive = true,
): Promise<TestChart3DHandle> {
	const three = (await import('three')) as unknown as ThreeViewContext['three'];
	let OrbitControls: ThreeViewContext['OrbitControls'] = null;
	try {
		OrbitControls = (await import('three/examples/jsm/controls/OrbitControls.js'))
			.OrbitControls as unknown as ThreeViewContext['OrbitControls'];
	} catch {
		OrbitControls = null;
	}
	const renderer = new three.WebGLRenderer();
	const canvas = renderer.domElement;
	container.appendChild(canvas);
	const size = (w: number, h: number) => ({ width: w, height: h, pixelWidth: w, pixelHeight: h });
	const scene = factory(
		{
			three,
			OrbitControls,
			size: size(options.width, options.height),
			eventTarget: canvas,
			overlay: container as unknown as HTMLElement,
			document: (container.ownerDocument ??
				(typeof document === 'undefined' ? undefined : document)) as Document,
			interactive,
			requestRender: () => {},
			emit: (event) => {
				if (event.type === 'select') {
					interaction?.onSelect?.(event.part);
				} else if (event.detail.phase === 'move') {
					interaction?.onValueDragPreview?.(event.detail.part, event.detail.value);
				} else {
					interaction?.onValueDragCommit?.(event.detail.part, event.detail.value);
				}
			},
		},
		options,
	);
	return {
		ok: true,
		scene,
		canvas,
		render: () => scene.render(renderer),
		resize: (w, h) => scene.resize(size(w, h)),
		setSelectedPart: (part) => scene.setSelectedPart?.(part),
		setTextStyle: (style) => scene.setTextStyle?.(style),
		setInteractive: (on) => scene.setInteractive?.(on),
		dispose: () => {
			scene.dispose();
			canvas.remove();
		},
	};
}
