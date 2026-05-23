import { describe, it, expect } from 'vitest';

import type {
	ConnectorPptxElement,
	ImagePptxElement,
	MediaPptxElement,
	TextPptxElement,
} from '../../types';
import { ConnectorXmlFactory } from './ConnectorXmlFactory';
import { MediaGraphicFrameXmlFactory } from './MediaGraphicFrameXmlFactory';
import { PictureXmlFactory } from './PictureXmlFactory';
import { PptxXmlFactoryProvider } from './PptxXmlFactoryProvider';
import { TextShapeXmlFactory } from './TextShapeXmlFactory';
import type { PptxBuilderFactoryContext } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(): PptxBuilderFactoryContext {
	let nextId = 1;
	return {
		emuPerPx: 9525,
		getNextId: () => nextId++,
		normalizePresetGeometry: (shapeType) => shapeType || 'rect',
		toDrawingTextVerticalAlign: () => undefined,
	};
}

// ---------------------------------------------------------------------------
// PptxXmlFactoryProvider
// ---------------------------------------------------------------------------

describe('pptxXmlFactoryProvider', () => {
	it('creates a TextShapeXmlFactory from createTextShapeFactory', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createTextShapeFactory(createMockContext());
		expect(factory).toBeInstanceOf(TextShapeXmlFactory);
	});

	it('creates a ConnectorXmlFactory from createConnectorFactory', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createConnectorFactory(createMockContext());
		expect(factory).toBeInstanceOf(ConnectorXmlFactory);
	});

	it('creates a PictureXmlFactory from createPictureFactory', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createPictureFactory(createMockContext());
		expect(factory).toBeInstanceOf(PictureXmlFactory);
	});

	it('creates a MediaGraphicFrameXmlFactory from createMediaGraphicFrameFactory', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createMediaGraphicFrameFactory(createMockContext());
		expect(factory).toBeInstanceOf(MediaGraphicFrameXmlFactory);
	});

	it('creates independent factory instances per call', () => {
		const provider = new PptxXmlFactoryProvider();
		const ctx = createMockContext();
		const f1 = provider.createTextShapeFactory(ctx);
		const f2 = provider.createTextShapeFactory(ctx);
		expect(f1).not.toBe(f2);
	});

	it('created text factory produces valid XML', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createTextShapeFactory(createMockContext());
		const result = factory.createXmlElement({
			element: {
				type: 'text',
				id: 't1',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				text: 'test',
			} as unknown as TextPptxElement,
		});
		expect(result['p:nvSpPr']).toBeDefined();
		expect(result['p:spPr']).toBeDefined();
		expect(result['p:txBody']).toBeDefined();
	});

	it('created connector factory produces valid XML', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createConnectorFactory(createMockContext());
		const result = factory.createXmlElement({
			element: {
				type: 'connector',
				id: 'c1',
				x: 0,
				y: 0,
				width: 100,
				height: 0,
			} as unknown as ConnectorPptxElement,
		});
		expect(result['p:nvCxnSpPr']).toBeDefined();
		expect(result['p:spPr']).toBeDefined();
	});

	it('created picture factory produces valid XML', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createPictureFactory(createMockContext());
		const result = factory.createXmlElement({
			element: {
				type: 'image',
				id: 'i1',
				x: 0,
				y: 0,
				width: 100,
				height: 75,
			} as unknown as ImagePptxElement,
			relationshipId: 'rId1',
		});
		expect(result['p:nvPicPr']).toBeDefined();
		expect(result['p:blipFill']).toBeDefined();
		expect(result['p:spPr']).toBeDefined();
	});

	it('created media factory produces valid XML', () => {
		const provider = new PptxXmlFactoryProvider();
		const factory = provider.createMediaGraphicFrameFactory(createMockContext());
		const result = factory.createXmlElement({
			element: {
				type: 'media',
				id: 'm1',
				x: 0,
				y: 0,
				width: 320,
				height: 240,
				mediaType: 'video',
			} as unknown as MediaPptxElement,
			relationshipId: 'rId3',
		});
		expect(result['p:nvGraphicFramePr']).toBeDefined();
		expect(result['a:graphic']).toBeDefined();
	});
});
