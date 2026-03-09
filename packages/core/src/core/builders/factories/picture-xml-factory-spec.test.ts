import { describe, it, expect } from 'vitest';
import { PictureXmlFactory } from './PictureXmlFactory';
import type { PptxBuilderFactoryContext } from './types';
import type { PptxImageLikeElement, XmlObject } from '../../types';

const EMU_PER_PX = 9525;

function createMockContext(
	overrides?: Partial<PptxBuilderFactoryContext>
): PptxBuilderFactoryContext {
	let nextId = 50;
	return {
		emuPerPx: EMU_PER_PX,
		getNextId: () => nextId++,
		normalizePresetGeometry: (shapeType) => shapeType || 'rect',
		toDrawingTextVerticalAlign: () => undefined,
		...overrides,
	};
}

function createImageElement(
	overrides: Partial<PptxImageLikeElement> = {}
): PptxImageLikeElement {
	return {
		type: 'image',
		id: 'img_1',
		x: 100,
		y: 200,
		width: 400,
		height: 300,
		...overrides,
	} as PptxImageLikeElement;
}

describe('PictureXmlFactory', () => {
	it('should produce p:nvPicPr, p:blipFill, and p:spPr nodes', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId2',
		});
		expect(result['p:nvPicPr']).toBeDefined();
		expect(result['p:blipFill']).toBeDefined();
		expect(result['p:spPr']).toBeDefined();
	});

	it('should reference the relationship ID in a:blip r:embed', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId5',
		});
		const blipFill = result['p:blipFill'] as XmlObject;
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['@_r:embed']).toBe('rId5');
	});

	it('should include a:stretch with a:fillRect by default', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId2',
		});
		const blipFill = result['p:blipFill'] as XmlObject;
		const stretch = blipFill['a:stretch'] as XmlObject;
		expect(stretch).toBeDefined();
		expect(stretch['a:fillRect']).toEqual({});
	});

	it('should convert position and size from px to EMU', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement({
				x: 96,
				y: 96,
				width: 320,
				height: 240,
			}),
			relationshipId: 'rId2',
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		const off = xfrm['a:off'] as XmlObject;
		const ext = xfrm['a:ext'] as XmlObject;
		expect(off['@_x']).toBe(String(Math.round(96 * EMU_PER_PX)));
		expect(off['@_y']).toBe(String(Math.round(96 * EMU_PER_PX)));
		expect(ext['@_cx']).toBe(String(Math.round(320 * EMU_PER_PX)));
		expect(ext['@_cy']).toBe(String(Math.round(240 * EMU_PER_PX)));
	});

	it('should set rotation on a:xfrm when element has rotation', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement({ rotation: 90 }),
			relationshipId: 'rId2',
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		// rotation = 90 * 60000 = 5400000
		expect(xfrm['@_rot']).toBe(String(Math.round(90 * 60000)));
	});

	it('should set flipH when element has flipHorizontal', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement({ flipHorizontal: true }),
			relationshipId: 'rId2',
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		expect(xfrm['@_flipH']).toBe('1');
	});

	it('should set flipV when element has flipVertical', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement({ flipVertical: true }),
			relationshipId: 'rId2',
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		expect(xfrm['@_flipV']).toBe('1');
	});

	it('should not set rotation/flip attributes when they are absent', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement({
				rotation: undefined,
				flipHorizontal: undefined,
				flipVertical: undefined,
			}),
			relationshipId: 'rId2',
		});
		const spPr = result['p:spPr'] as XmlObject;
		const xfrm = spPr['a:xfrm'] as XmlObject;
		expect(xfrm['@_rot']).toBeUndefined();
		expect(xfrm['@_flipH']).toBeUndefined();
		expect(xfrm['@_flipV']).toBeUndefined();
	});

	it('should always use rect preset geometry', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const result = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId2',
		});
		const spPr = result['p:spPr'] as XmlObject;
		const prstGeom = spPr['a:prstGeom'] as XmlObject;
		expect(prstGeom['@_prst']).toBe('rect');
		expect(prstGeom['a:avLst']).toEqual({});
	});

	it('should generate unique IDs for successive pictures', () => {
		const factory = new PictureXmlFactory(createMockContext());
		const r1 = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId2',
		});
		const r2 = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId3',
		});
		const nvPicPr1 = r1['p:nvPicPr'] as XmlObject;
		const nvPicPr2 = r2['p:nvPicPr'] as XmlObject;
		const id1 = (nvPicPr1['p:cNvPr'] as XmlObject)['@_id'];
		const id2 = (nvPicPr2['p:cNvPr'] as XmlObject)['@_id'];
		expect(id1).not.toBe(id2);
	});

	it('should generate "Picture N" name with the assigned ID', () => {
		let nextId = 7;
		const factory = new PictureXmlFactory(
			createMockContext({ getNextId: () => nextId++ })
		);
		const result = factory.createXmlElement({
			element: createImageElement(),
			relationshipId: 'rId2',
		});
		const nvPicPr = result['p:nvPicPr'] as XmlObject;
		const cNvPr = nvPicPr['p:cNvPr'] as XmlObject;
		expect(cNvPr['@_id']).toBe('7');
		expect(cNvPr['@_name']).toBe('Picture 7');
	});
});
