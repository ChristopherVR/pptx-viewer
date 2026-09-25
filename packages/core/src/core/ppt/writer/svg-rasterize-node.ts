/**
 * Node.js SVG -> PNG rasteriser for the `.ppt` writer, through the optional
 * `@napi-rs/canvas` peer (the same Node canvas backend `emf-converter`
 * already falls back to), whose `loadImage` decodes SVG with Skia's SVG
 * module. Returns `undefined` when the package is not installed, so the
 * caller keeps degrading to a placeholder with a warning.
 *
 * @module ppt/writer/svg-rasterize-node
 */

/** The slice of `@napi-rs/canvas` this module uses. */
interface NodeCanvasImage {
	readonly width: number;
	readonly height: number;
}
interface NodeCanvasContext {
	drawImage(image: NodeCanvasImage, dx: number, dy: number, dw: number, dh: number): void;
}
interface NodeCanvas {
	getContext(kind: '2d'): NodeCanvasContext;
	toBuffer(mime: 'image/png'): Uint8Array;
}
interface NodeCanvasModule {
	createCanvas(width: number, height: number): NodeCanvas;
	loadImage(source: Uint8Array): Promise<NodeCanvasImage>;
}

/** Module specifier kept in a variable so browser bundlers never try to resolve it. */
const NODE_CANVAS_SPECIFIER = '@napi-rs/canvas';

let nodeCanvas: Promise<NodeCanvasModule | undefined> | undefined;

function isNodeCanvasModule(value: unknown): value is NodeCanvasModule {
	const candidate = value as Partial<NodeCanvasModule> | null;
	return typeof candidate?.createCanvas === 'function' && typeof candidate.loadImage === 'function';
}

function loadNodeCanvas(): Promise<NodeCanvasModule | undefined> {
	nodeCanvas ??= (async () => {
		const runtime = (globalThis as { process?: { versions?: { node?: string } } }).process;
		if (!runtime?.versions?.node) {
			return undefined;
		}
		try {
			const imported: unknown = await import(
				/* webpackIgnore: true */ /* @vite-ignore */ NODE_CANVAS_SPECIFIER
			);
			const withDefault = imported as { default?: unknown };
			if (isNodeCanvasModule(imported)) {
				return imported;
			}
			return isNodeCanvasModule(withDefault.default) ? withDefault.default : undefined;
		} catch {
			return undefined;
		}
	})();
	return nodeCanvas;
}

/**
 * Rasterise SVG bytes to PNG through `@napi-rs/canvas`, sized by `sizeFor`
 * from the SVG's intrinsic size (0 when it declares none).
 *
 * @returns PNG bytes, or `undefined` without the package or on a bad SVG.
 */
export async function rasterizeSvgInNode(
	svg: Uint8Array,
	sizeFor: (intrinsicW: number, intrinsicH: number) => { width: number; height: number },
): Promise<Uint8Array | undefined> {
	const canvasModule = await loadNodeCanvas();
	if (!canvasModule) {
		return undefined;
	}
	try {
		const image = await canvasModule.loadImage(svg);
		const { width, height } = sizeFor(image.width, image.height);
		const canvas = canvasModule.createCanvas(width, height);
		canvas.getContext('2d').drawImage(image, 0, 0, width, height);
		return new Uint8Array(canvas.toBuffer('image/png'));
	} catch {
		return undefined;
	}
}
