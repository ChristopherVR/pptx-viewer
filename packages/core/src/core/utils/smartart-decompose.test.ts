import { describe, it, expect, beforeEach } from 'vitest';

import type { PptxSmartArtData, PptxSmartArtNode, PptxSmartArtDrawingShape } from '../types';
import { decomposeSmartArt } from './smartart-decompose';
import { resetDecomposeCounter } from './smartart-helpers';

// Reset the counter before each test for deterministic IDs.
beforeEach(() => {
	resetDecomposeCounter();
});

const bounds = { x: 0, y: 0, width: 400, height: 300 };

function makeNodes(texts: string[]): PptxSmartArtNode[] {
	return texts.map((text, i) => ({
		id: String(i + 1),
		text,
	}));
}

// ---------------------------------------------------------------------------
// decomposeSmartArt — basic
// ---------------------------------------------------------------------------

describe('decomposeSmartArt — basic', () => {
	it('returns undefined for empty node list', () => {
		const data: PptxSmartArtData = { nodes: [] };
		expect(decomposeSmartArt(data, bounds)).toBeUndefined();
	});

	it('returns undefined when nodes is undefined-like', () => {
		const data: PptxSmartArtData = { nodes: [] };
		expect(decomposeSmartArt(data, bounds)).toBeUndefined();
	});

	it('returns elements for a list layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: makeNodes(['A', 'B', 'C']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!).toHaveLength(3);
	});

	it('returns elements for a process layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'process',
			nodes: makeNodes(['A', 'B']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		// 2 shapes + 1 connector
		expect(result!).toHaveLength(3);
	});

	it('returns elements for a cycle layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'cycle',
			nodes: makeNodes(['A', 'B', 'C']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!.length).toBeGreaterThan(0);
	});

	it('returns elements for a hierarchy layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'hierarchy',
			nodes: [
				{ id: '1', text: 'Root' },
				{ id: '2', text: 'Child', parentId: '1' },
			],
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		const shapes = result!.filter((e) => e.type === 'shape');
		const connectors = result!.filter((e) => e.type === 'connector');
		expect(shapes).toHaveLength(2);
		expect(connectors).toHaveLength(1);
	});

	it('returns elements for a matrix layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'matrix',
			nodes: makeNodes(['A', 'B', 'C', 'D']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!).toHaveLength(4);
	});

	it('returns elements for a pyramid layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'pyramid',
			nodes: makeNodes(['Top', 'Mid', 'Bot']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!).toHaveLength(3);
	});

	it('returns elements for a relationship (Venn) layout', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'relationship',
			nodes: makeNodes(['A', 'B']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — drawing shapes (pre-computed)
// ---------------------------------------------------------------------------

describe('decomposeSmartArt — drawing shapes', () => {
	it('prefers drawing shapes over algorithmic layout', () => {
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'ds1', x: 0, y: 0, width: 100, height: 50, text: 'Box A' },
			{ id: 'ds2', x: 120, y: 0, width: 100, height: 50, text: 'Box B' },
		];
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'process',
			nodes: makeNodes(['A', 'B']),
			drawingShapes,
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!).toHaveLength(2);
		// Text from the drawing shape should be used
		expect((result![0] as Record<string, unknown>).text).toBe('Box A');
	});

	it('places drawing shapes at their OWN cached size/position, offset only by the container origin - NOT rescaled to fill the container (round 9 fix)', () => {
		// `dsp:sp`'s own `a:xfrm` is already in the SAME coordinate space as
		// `containerBounds` (both the same EMU-per-px conversion, baked to
		// match the CURRENT frame extent) - a PREVIOUS version rescaled
		// every shape to fill `containerBounds` via the shapes' own bounding
		// box, which is WRONG whenever a `lin`-arranged diagram's natural
		// content does not fill an oversized frame on one axis (measured
		// against `basic-process--hier5.pptx`: 137px-tall real content
		// inside a 533px-tall frame, inflated 3.89x by the old logic). Here
		// a 200x50pt real drawing box inside a much taller 200x400 container
		// must stay 200x50, NOT stretch to 200x400.
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'ds1', x: 10, y: 100, width: 200, height: 50, text: 'A' },
		];
		const data: PptxSmartArtData = {
			nodes: makeNodes(['A']),
			drawingShapes,
		};
		const tallContainer = { x: 5, y: 20, width: 200, height: 400 };
		const result = decomposeSmartArt(data, tallContainer);
		expect(result).toBeDefined();
		const [el] = result!;
		expect(el.width).toBe(200);
		expect(el.height).toBe(50);
		expect(el.x).toBe(tallContainer.x + 10);
		expect(el.y).toBe(tallContainer.y + 100);
	});

	it('uses drawing shape fillColor', () => {
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'ds1', x: 0, y: 0, width: 100, height: 50, fillColor: '#FF0000' },
		];
		const data: PptxSmartArtData = {
			nodes: makeNodes(['A']),
			drawingShapes,
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect((result![0] as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#FF0000',
		);
	});

	it('preserves cached drawing shape rotation and skew', () => {
		const data: PptxSmartArtData = {
			nodes: makeNodes(['A']),
			drawingShapes: [
				{
					id: 'ds1',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					rotation: 15,
					skewX: 10,
					skewY: -5,
				},
			],
		};

		const result = decomposeSmartArt(data, bounds);

		expect(result?.[0]).toMatchObject({ rotation: 15, skewX: 10, skewY: -5 });
	});

	it('applies colorTransform fills when drawing shapes lack fillColor', () => {
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'ds1', x: 0, y: 0, width: 100, height: 50 },
		];
		const data: PptxSmartArtData = {
			nodes: makeNodes(['A']),
			drawingShapes,
			colorTransform: {
				fillColors: ['#AABB00'],
				lineColors: [],
				name: 'test',
			},
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect((result![0] as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#AABB00',
		);
	});

	it('applies quickStyle stroke scale for intense effect', () => {
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'ds1', x: 0, y: 0, width: 100, height: 50, strokeWidth: 2 },
		];
		const data: PptxSmartArtData = {
			nodes: makeNodes(['A']),
			drawingShapes,
			quickStyle: { effectIntensity: 'intense' },
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		// Intense effect doubles stroke width: 2 * 2 = 4
		expect((result![0] as { shapeStyle: Record<string, unknown> }).shapeStyle.strokeWidth).toBe(4);
	});

	it('applies quickStyle stroke scale for subtle effect', () => {
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'ds1', x: 0, y: 0, width: 100, height: 50, strokeWidth: 2 },
		];
		const data: PptxSmartArtData = {
			nodes: makeNodes(['A']),
			drawingShapes,
			quickStyle: { effectIntensity: 'subtle' },
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		// Subtle effect halves stroke width: 2 * 0.5 = 1
		expect((result![0] as { shapeStyle: Record<string, unknown> }).shapeStyle.strokeWidth).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — drawing shapes match live PowerPoint COM geometry
// (round 10): round 9's "no scaling, direct offset" model was challenged by
// a coordinator-relayed report (Track R) that PowerPoint DOES scale
// dsp:drawing to the graphicFrame, citing "COM-verified" 371.7px/347x232px
// figures for `hierarchy--hier5.pptx`/`basic-cycle--flat3.pptx`. Settled
// with FRESH live COM (PowerPoint.Application via `scripts/pptx-com-open
// .ps1`'s pattern): (1) `AllNodes.Shapes.Item(i)` real geometry, in points,
// for `hierarchy--hier5.pptx` (works cleanly for this fixture); (2) since
// that accessor returns a degenerate proxy (Type=-2, every property empty)
// for `basic-cycle--flat3.pptx`'s cycle-ring ellipses, cross-checked via
// "Convert to Shapes" (Duplicate + `CommandBars.ExecuteMso
// ("SmartArtConvertToShapes")` on the copy, never the original file) AND an
// independent PIXEL measurement of the exported slide PNG (aspect-ratio-
// corrected against `pres.PageSetup.SlideWidth/Height` - an earlier
// uncorrected export falsely showed a 1.33 height/width aspect, traced to
// the export request using a hardcoded 4:3 canvas for a 16:9 slide, not a
// real rendering difference). All three methods agree with each other AND
// with the raw `drawing1.xml` `dsp:sp` EMU offsets to within rounding, on
// BOTH fixtures: the shape geometry is genuinely `frameOrigin + rawEmuOffset`
// (this module's existing, round-9 model), with NO frame-fill scaling
// applied by PowerPoint. Track R's cited 371.7px/347x232px figures do not
// match anything this session's live COM produced for either fixture; per
// the fresh `baseline.json` regenerated this round, both fixtures'
// `maxDeltaFraction` (20.07%/16.49%) is real but lives on the INTERPRETER
// side (`computeSmartArtElementsWithoutCache`'s hierarchy/cycle algorithms),
// not the cached-reader side this module owns - see the round 10 successor
// doc for the full COM table.
describe('decomposeSmartArt — matches live PowerPoint COM geometry (round 10)', () => {
	it("hierarchy--hier5.pptx's 'Node One' text box: COM Left=296.4453pt Top=106.3591pt Width=154.248pt Height=97.94748pt (AllNodes.Shapes.Item(1), points*4/3=px below) - frame origin + raw offset, no scaling", () => {
		// Frame (COM): Left=40pt Top=90pt Width=650pt Height=400pt -> px (*4/3).
		const containerBounds = { x: 53.333, y: 120, width: 866.667, height: 533.333 };
		// dsp:sp's own a:xfrm for the "Node One" text box, EMU/9525 (this
		// codebase's own px convention) - matches raw drawing1.xml exactly.
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{
				id: 'node-one-text',
				x: 341.927,
				y: 21.812,
				width: 205.664,
				height: 130.597,
				text: 'Node One',
			},
		];
		const data: PptxSmartArtData = { nodes: makeNodes(['Node One']), drawingShapes };
		const result = decomposeSmartArt(data, containerBounds);
		expect(result).toBeDefined();
		const [el] = result!;
		// COM Left=296.4453pt*4/3=395.26px, Top=106.3591pt*4/3=141.81px,
		// Width=154.248pt*4/3=205.66px, Height=97.94748pt*4/3=130.60px.
		// `makeShapeElement` rounds to the nearest whole px.
		expect(el.x).toBe(395);
		expect(el.y).toBe(142);
		expect(el.width).toBe(206);
		expect(el.height).toBe(131);
	});

	it("basic-cycle--flat3.pptx's 'Alpha' ellipse: COM Left=278.0371pt Width=173.9258pt Height=173.9258pt (Convert-to-Shapes GroupItems AND a pixel-measured exported PNG both agree: 231.9x231.9px, a CIRCLE, not Track R's cited 347x232 wide ellipse) - no scaling", () => {
		// Frame (COM): Left=40pt Top=90pt Width=650pt Height=400pt -> px.
		const containerBounds = { x: 53.333, y: 120, width: 866.667, height: 533.333 };
		const drawingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'alpha', x: 317.383, y: 0.044, width: 231.901, height: 231.901, text: 'Alpha' },
		];
		const data: PptxSmartArtData = { nodes: makeNodes(['Alpha']), drawingShapes };
		const result = decomposeSmartArt(data, containerBounds);
		expect(result).toBeDefined();
		const [el] = result!;
		// COM Left=278.0371pt*4/3=370.72px; Width/Height=173.9258pt*4/3=231.90px
		// (a perfect square - a circle, matching the raw EMU value exactly).
		// `makeShapeElement` rounds to the nearest whole px.
		expect(el.x).toBe(371);
		expect(el.width).toBe(232);
		expect(el.height).toBe(232);
		expect(el.width).toBe(el.height);
	});
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — heuristic / unknown layout
// ---------------------------------------------------------------------------

describe('decomposeSmartArt — unknown layout heuristic', () => {
	it('uses heuristic for unknown layout type', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'unknown',
			nodes: makeNodes(['A', 'B']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect(result!.length).toBeGreaterThan(0);
	});

	it('picks hierarchy for nodes with children', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'unknown',
			nodes: [
				{ id: '1', text: 'Root', children: [{ id: '2', text: 'Child' }] },
				{ id: '2', text: 'Child', parentId: '1' },
			],
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		// Should produce connectors for a hierarchy layout
		const connectors = result!.filter((e) => e.type === 'connector');
		expect(connectors.length).toBeGreaterThan(0);
	});

	it('returns undefined when content nodes are all empty text', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'unknown',
			nodes: [{ id: '1', text: '' }],
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — layout type resolution from raw string
// ---------------------------------------------------------------------------

describe('decomposeSmartArt — raw layout type resolution', () => {
	it("resolves 'hierarchy' from raw layoutType", () => {
		const data: PptxSmartArtData = {
			layoutType: 'hierarchy',
			nodes: [
				{ id: '1', text: 'Root' },
				{ id: '2', text: 'Child', parentId: '1' },
			],
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		// Should have connectors since it's hierarchy
		const connectors = result!.filter((e) => e.type === 'connector');
		expect(connectors.length).toBeGreaterThan(0);
	});

	it("resolves 'cycle' from raw layoutType containing 'radial'", () => {
		const data: PptxSmartArtData = {
			layoutType: 'basicRadial',
			nodes: makeNodes(['A', 'B', 'C']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
	});

	it("resolves 'process' from raw layoutType containing 'chevron'", () => {
		const data: PptxSmartArtData = {
			layoutType: 'basicChevronProcess',
			nodes: makeNodes(['A', 'B']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
	});

	it("resolves 'relationship' from raw layoutType containing 'venn'", () => {
		const data: PptxSmartArtData = {
			layoutType: 'basicVenn',
			nodes: makeNodes(['A', 'B']),
		};
		const result = decomposeSmartArt(data, bounds);
		expect(result).toBeDefined();
		expect((result![0] as Record<string, unknown>).shapeType).toBe('ellipse');
	});
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — colour transform integration
// ---------------------------------------------------------------------------

describe('decomposeSmartArt — colour transforms', () => {
	it('overlays colorTransform fills onto theme map', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: makeNodes(['A']),
			colorTransform: {
				fillColors: ['#AABBCC'],
				lineColors: [],
			},
		};
		const theme = { accent1: '#FFFFFF' };
		const result = decomposeSmartArt(data, bounds, theme);
		expect(result).toBeDefined();
		// The colorTransform fill should override the theme accent1
		expect((result![0] as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#AABBCC',
		);
	});

	it('passes through theme map when no colorTransform', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: makeNodes(['A']),
		};
		const theme = { accent1: '#FACADE' };
		const result = decomposeSmartArt(data, bounds, theme);
		expect(result).toBeDefined();
		expect((result![0] as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor).toBe(
			'#FACADE',
		);
	});
});

// ---------------------------------------------------------------------------
// decomposeSmartArt — presentation layout variables (direction)
// ---------------------------------------------------------------------------

describe('decomposeSmartArt — presLayoutVars direction', () => {
	it('keeps node order for normal direction', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: makeNodes(['A', 'B', 'C']),
			presLayoutVars: { direction: 'norm' },
		};
		const result = decomposeSmartArt(data, bounds)!;
		const shapes = result.filter((e) => e.type === 'shape');
		expect((shapes[0] as Record<string, unknown>).text).toBe('A');
		expect((shapes[2] as Record<string, unknown>).text).toBe('C');
	});

	it('reverses node order when direction is rev (from presLayoutVars)', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'list',
			nodes: makeNodes(['A', 'B', 'C']),
			presLayoutVars: { direction: 'rev' },
		};
		const result = decomposeSmartArt(data, bounds)!;
		const shapes = result.filter((e) => e.type === 'shape');
		expect((shapes[0] as Record<string, unknown>).text).toBe('C');
		expect((shapes[2] as Record<string, unknown>).text).toBe('A');
	});
});
