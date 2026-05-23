import { describe, it, expect, beforeEach } from 'vitest';

import { resetIdCounter, createTextElement, createShapeElement } from './ElementFactory';
import { GroupBuilder } from './GroupBuilder';
import { MediaBuilder } from './MediaBuilder';
import { ShapeBuilder } from './ShapeBuilder';
import { TableBuilder } from './TableBuilder';
import { TextBuilder } from './TextBuilder';

beforeEach(() => {
	resetIdCounter();
});

// ===========================================================================
// MediaBuilder
// ===========================================================================

describe('mediaBuilder', () => {
	const VIDEO_DATA_URL = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t';
	const AUDIO_DATA_URL = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RT';
	const VIDEO_ARCHIVE_PATH = 'ppt/media/video1.mp4';
	const _AUDIO_ARCHIVE_PATH = 'ppt/media/audio1.mp3';

	// -- Factory methods ---------------------------------------------------

	it('mediaBuilder.video(source) creates a video element', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).build();
		expect(el.type).toBe('media');
		expect(el.mediaType).toBe('video');
		expect(el.mediaData).toBe(VIDEO_DATA_URL);
		expect(el.mediaPath).toBeUndefined();
	});

	it('mediaBuilder.audio(source) creates an audio element', () => {
		const el = MediaBuilder.audio(AUDIO_DATA_URL).build();
		expect(el.type).toBe('media');
		expect(el.mediaType).toBe('audio');
		expect(el.mediaData).toBe(AUDIO_DATA_URL);
	});

	it("mediaBuilder.create('video', source) is the same as .video()", () => {
		const el = MediaBuilder.create('video', VIDEO_DATA_URL).build();
		expect(el.type).toBe('media');
		expect(el.mediaType).toBe('video');
		expect(el.mediaData).toBe(VIDEO_DATA_URL);
	});

	it("mediaBuilder.create('audio', source) is the same as .audio()", () => {
		const el = MediaBuilder.create('audio', AUDIO_DATA_URL).build();
		expect(el.type).toBe('media');
		expect(el.mediaType).toBe('audio');
		expect(el.mediaData).toBe(AUDIO_DATA_URL);
	});

	it('generates a unique id with med prefix', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).build();
		expect(el.id).toMatch(/^med_/);
	});

	// -- Source handling ---------------------------------------------------

	it('handles data URL source (sets mediaData)', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).build();
		expect(el.mediaData).toBe(VIDEO_DATA_URL);
		expect(el.mediaPath).toBeUndefined();
	});

	it('handles archive path source (sets mediaPath)', () => {
		const el = MediaBuilder.video(VIDEO_ARCHIVE_PATH).build();
		expect(el.mediaPath).toBe(VIDEO_ARCHIVE_PATH);
		expect(el.mediaData).toBeUndefined();
	});

	// -- Playback options -------------------------------------------------

	it('.autoPlay() defaults to true', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).autoPlay().build();
		expect(el.autoPlay).toBeTruthy();
	});

	it('.autoPlay(false) sets false', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).autoPlay(false).build();
		expect(el.autoPlay).toBeFalsy();
	});

	it('.loop() defaults to true', () => {
		const el = MediaBuilder.audio(AUDIO_DATA_URL).loop().build();
		expect(el.loop).toBeTruthy();
	});

	it('.loop(false) sets false', () => {
		const el = MediaBuilder.audio(AUDIO_DATA_URL).loop(false).build();
		expect(el.loop).toBeFalsy();
	});

	it('.volume(0.5) sets volume', () => {
		const el = MediaBuilder.audio(AUDIO_DATA_URL).volume(0.5).build();
		expect(el.volume).toBe(0.5);
	});

	it('.trim(1000, 5000) sets trim start and end', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).trim(1000, 5000).build();
		expect(el.trimStartMs).toBe(1000);
		expect(el.trimEndMs).toBe(5000);
	});

	it('.posterFrame(dataUrl) sets the poster frame', () => {
		const poster = 'data:image/png;base64,iVBORw0KGgo=';
		const el = MediaBuilder.video(VIDEO_DATA_URL).posterFrame(poster).build();
		expect(el.posterFrameData).toBe(poster);
	});

	// -- Position & size --------------------------------------------------

	it('.position(x, y) sets element position', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).position(50, 75).build();
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
	});

	it('.size(w, h) sets element dimensions', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).size(640, 360).build();
		expect(el.width).toBe(640);
		expect(el.height).toBe(360);
	});

	it('.bounds(x, y, w, h) sets position and size together', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).bounds(10, 20, 800, 450).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(800);
		expect(el.height).toBe(450);
	});

	it('.rotation(degrees) sets rotation', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).rotation(90).build();
		expect(el.rotation).toBe(90);
	});

	it('uses default position/size when not specified', () => {
		const el = MediaBuilder.video(VIDEO_DATA_URL).build();
		expect(el.x).toBe(100);
		expect(el.y).toBe(100);
		expect(el.width).toBe(480);
		expect(el.height).toBe(270);
	});

	// -- Full chaining test -----------------------------------------------

	it('chains all methods fluently', () => {
		const poster = 'data:image/png;base64,iVBORw0KGgo=';
		const el = MediaBuilder.video(VIDEO_DATA_URL)
			.position(50, 100)
			.size(640, 360)
			.rotation(15)
			.autoPlay()
			.loop()
			.volume(0.8)
			.trim(500, 10000)
			.posterFrame(poster)
			.build();

		expect(el.type).toBe('media');
		expect(el.mediaType).toBe('video');
		expect(el.mediaData).toBe(VIDEO_DATA_URL);
		expect(el.x).toBe(50);
		expect(el.y).toBe(100);
		expect(el.width).toBe(640);
		expect(el.height).toBe(360);
		expect(el.rotation).toBe(15);
		expect(el.autoPlay).toBeTruthy();
		expect(el.loop).toBeTruthy();
		expect(el.volume).toBe(0.8);
		expect(el.trimStartMs).toBe(500);
		expect(el.trimEndMs).toBe(10000);
		expect(el.posterFrameData).toBe(poster);
	});
});

// ===========================================================================
// GroupBuilder
// ===========================================================================

describe('groupBuilder', () => {
	it('groupBuilder.create().build() creates an empty group element', () => {
		const el = GroupBuilder.create().build();
		expect(el.type).toBe('group');
		expect(el.children).toStrictEqual([]);
	});

	it('generates a unique id with grp prefix', () => {
		const el = GroupBuilder.create().build();
		expect(el.id).toMatch(/^grp_/);
	});

	it('.addChild(element) adds a pre-built element', () => {
		const text = createTextElement('Hello');
		const el = GroupBuilder.create().addChild(text).build();
		expect(el.children).toHaveLength(1);
		expect(el.children[0]).toBe(text);
		expect(el.children[0].type).toBe('text');
	});

	it('.addChildBuilder(builder) calls .build() on the builder', () => {
		const el = GroupBuilder.create()
			.addChildBuilder(TextBuilder.create('Built').fontSize(18))
			.build();
		expect(el.children).toHaveLength(1);
		expect(el.children[0].type).toBe('text');
		expect((el.children[0] as Record<string, unknown>).text).toBe('Built');
		expect((el.children[0] as Record<string, unknown>).textStyle?.fontSize).toBe(18);
	});

	it('.addChildren([...]) adds multiple elements at once', () => {
		const text = createTextElement('A');
		const shape = createShapeElement('rect');
		const el = GroupBuilder.create().addChildren([text, shape]).build();
		expect(el.children).toHaveLength(2);
		expect(el.children[0].type).toBe('text');
		expect(el.children[1].type).toBe('shape');
	});

	// -- Position & size --------------------------------------------------

	it('.position(x, y) sets group position', () => {
		const el = GroupBuilder.create().position(100, 200).build();
		expect(el.x).toBe(100);
		expect(el.y).toBe(200);
	});

	it('.size(w, h) sets group dimensions', () => {
		const el = GroupBuilder.create().size(500, 300).build();
		expect(el.width).toBe(500);
		expect(el.height).toBe(300);
	});

	it('.bounds(x, y, w, h) sets position and size together', () => {
		const el = GroupBuilder.create().bounds(10, 20, 400, 250).build();
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(400);
		expect(el.height).toBe(250);
	});

	it('.rotation(degrees) sets rotation', () => {
		const el = GroupBuilder.create().rotation(45).build();
		expect(el.rotation).toBe(45);
	});

	it('uses default position/size when not specified', () => {
		const el = GroupBuilder.create().build();
		expect(el.x).toBe(0);
		expect(el.y).toBe(0);
		expect(el.width).toBe(600);
		expect(el.height).toBe(400);
	});

	// -- Nested groups ----------------------------------------------------

	it('supports nested groups', () => {
		const innerGroup = GroupBuilder.create().addChildBuilder(TextBuilder.create('Nested')).build();
		const outerGroup = GroupBuilder.create().addChild(innerGroup).build();
		expect(outerGroup.children).toHaveLength(1);
		expect(outerGroup.children[0].type).toBe('group');
		expect((outerGroup.children[0] as { children: Array<{ type: string }> }).children).toHaveLength(
			1,
		);
		expect((outerGroup.children[0] as { children: Array<{ type: string }> }).children[0].type).toBe(
			'text',
		);
	});

	// -- Full chaining test -----------------------------------------------

	it('chains all methods fluently', () => {
		const shape = createShapeElement('ellipse');
		const el = GroupBuilder.create()
			.addChild(shape)
			.addChildBuilder(TextBuilder.create('Label').fontSize(14))
			.addChildren([createTextElement('Extra')])
			.position(50, 75)
			.size(400, 300)
			.rotation(10)
			.build();

		expect(el.type).toBe('group');
		expect(el.children).toHaveLength(3);
		expect(el.children[0].type).toBe('shape');
		expect(el.children[1].type).toBe('text');
		expect(el.children[2].type).toBe('text');
		expect(el.x).toBe(50);
		expect(el.y).toBe(75);
		expect(el.width).toBe(400);
		expect(el.height).toBe(300);
		expect(el.rotation).toBe(10);
	});
});

// ===========================================================================
// TextBuilder strikethrough
// ===========================================================================

describe('textBuilder.strikethrough', () => {
	it('.strikethrough() defaults to true', () => {
		const el = TextBuilder.create('Deprecated').strikethrough().build();
		expect(el.textStyle?.strikethrough).toBeTruthy();
	});

	it('.strikethrough(false) sets false', () => {
		const el = TextBuilder.create('Active').strikethrough(false).build();
		expect(el.textStyle?.strikethrough).toBeFalsy();
	});

	it('appears in the built element and chains with other styles', () => {
		const el = TextBuilder.create('Old Price')
			.fontSize(16)
			.strikethrough()
			.color('#999999')
			.build();
		expect(el.textStyle?.strikethrough).toBeTruthy();
		expect(el.textStyle?.fontSize).toBe(16);
		expect(el.textStyle?.color).toBe('#999999');
	});
});

// ===========================================================================
// ShapeBuilder convenience fills
// ===========================================================================

describe('shapeBuilder convenience fills', () => {
	it('.solidFill(color) sets solid fill', () => {
		const el = ShapeBuilder.create('rect').solidFill('#FF0000').build();
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(el.shapeStyle?.fillColor).toBe('#FF0000');
	});

	it('.solidFill(color, opacity) sets solid fill with opacity', () => {
		const el = ShapeBuilder.create('rect').solidFill('#FF0000', 0.5).build();
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(el.shapeStyle?.fillColor).toBe('#FF0000');
		expect(el.shapeStyle?.fillOpacity).toBe(0.5);
	});

	it('.noFill() sets no fill', () => {
		const el = ShapeBuilder.create('rect').noFill().build();
		expect(el.shapeStyle?.fillMode).toBe('none');
	});

	it('.gradientFill(stops) sets gradient fill', () => {
		const stops = [
			{ color: '#FF0000', position: 0 },
			{ color: '#0000FF', position: 1 },
		];
		const el = ShapeBuilder.create('rect').gradientFill(stops).build();
		expect(el.shapeStyle?.fillMode).toBe('gradient');
		expect(el.shapeStyle?.fillGradientStops).toHaveLength(2);
		expect(el.shapeStyle?.fillGradientStops![0].color).toBe('#FF0000');
		expect(el.shapeStyle?.fillGradientStops![1].color).toBe('#0000FF');
	});

	it('.gradientFill(stops, angle) sets gradient fill with angle', () => {
		const stops = [
			{ color: '#000000', position: 0 },
			{ color: '#FFFFFF', position: 1 },
		];
		const el = ShapeBuilder.create('rect').gradientFill(stops, 45).build();
		expect(el.shapeStyle?.fillMode).toBe('gradient');
		expect(el.shapeStyle?.fillGradientAngle).toBe(45);
		expect(el.shapeStyle?.fillGradientStops).toHaveLength(2);
	});
});

// ===========================================================================
// TableBuilder row/col highlighting
// ===========================================================================

describe('tableBuilder row/col highlighting', () => {
	it('.lastRow() defaults to true', () => {
		const el = TableBuilder.create().addRow(['Total', '100']).lastRow().build();
		expect(el.tableData.lastRow).toBeTruthy();
	});

	it('.firstCol() defaults to true', () => {
		const el = TableBuilder.create().addRow(['Category', 'Value']).firstCol().build();
		expect(el.tableData.firstCol).toBeTruthy();
	});

	it('.lastCol() defaults to true', () => {
		const el = TableBuilder.create().addRow(['Name', 'Total']).lastCol().build();
		expect(el.tableData.lastCol).toBeTruthy();
	});

	it('.lastRow(false) sets false', () => {
		const el = TableBuilder.create().addRow(['A', 'B']).lastRow(false).build();
		expect(el.tableData.lastRow).toBeFalsy();
	});

	it('all highlighting flags can be combined', () => {
		const el = TableBuilder.create()
			.headerRow(['Name', 'Q1', 'Total'])
			.addRow(['Alice', '95', '95'])
			.addRow(['Total', '95', '95'])
			.lastRow()
			.firstCol()
			.lastCol()
			.build();
		expect(el.tableData.firstRowHeader).toBeTruthy();
		expect(el.tableData.lastRow).toBeTruthy();
		expect(el.tableData.firstCol).toBeTruthy();
		expect(el.tableData.lastCol).toBeTruthy();
	});
});
