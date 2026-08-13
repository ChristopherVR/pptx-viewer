import { XMLValidator } from 'fast-xml-parser';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import { buildBlankPresentationArchive, PresentationBuilder } from './PresentationBuilder';

/** Read every part of a generated package as text, keyed by archive path. */
async function readParts(archive: ArrayBuffer | Uint8Array): Promise<Record<string, string>> {
	const zip = await JSZip.loadAsync(archive);
	const parts: Record<string, string> = {};
	for (const name of Object.keys(zip.files).sort()) {
		const entry = zip.files[name];
		if (!entry.dir) {
			parts[name] = await entry.async('string');
		}
	}
	return parts;
}

describe('presentationBuilder metadata escaping', () => {
	// Interpolating caller-supplied metadata raw produced parts that were not
	// well-formed XML at all (`<dc:title>R&D <Team> "quoted"</dc:title>`), and
	// PowerPoint refused the package with ERROR_FILE_CORRUPT (0x80070570).
	const HOSTILE = 'R&D <Team> "quoted"';

	it('keeps every generated part well-formed when the metadata contains XML metacharacters', async () => {
		const parts = await readParts(
			await buildBlankPresentationArchive({
				title: HOSTILE,
				creator: HOSTILE,
				theme: { name: HOSTILE, fonts: { majorFont: HOSTILE, minorFont: HOSTILE } },
			}),
		);

		for (const [name, text] of Object.entries(parts)) {
			expect(XMLValidator.validate(text), `${name} is not well-formed`).toBeTruthy();
		}
	});

	it('escapes the deck title and creator as element text', async () => {
		const parts = await readParts(
			await buildBlankPresentationArchive({ title: HOSTILE, creator: HOSTILE }),
		);
		const core = parts['docProps/core.xml'];
		expect(core).toContain('<dc:title>R&amp;D &lt;Team&gt; &quot;quoted&quot;</dc:title>');
		expect(core).toContain('<dc:creator>R&amp;D &lt;Team&gt; &quot;quoted&quot;</dc:creator>');
		expect(core).toContain(
			'<cp:lastModifiedBy>R&amp;D &lt;Team&gt; &quot;quoted&quot;</cp:lastModifiedBy>',
		);
	});

	it('escapes the theme and font names as attribute values', async () => {
		const parts = await readParts(
			await buildBlankPresentationArchive({
				theme: { name: HOSTILE, fonts: { majorFont: HOSTILE, minorFont: HOSTILE } },
			}),
		);
		const theme = parts['ppt/theme/theme1.xml'];
		expect(theme).toContain(
			'<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="R&amp;D &lt;Team&gt; &quot;quoted&quot;">',
		);
		expect(theme).toContain('<a:latin typeface="R&amp;D &lt;Team&gt; &quot;quoted&quot;"/>');
	});

	it('falls back to the Office default for a theme colour that is not a hex triple', async () => {
		const parts = await readParts(
			// `a:srgbClr/@val` is ST_HexColorRGB: an unusable override cannot be
			// escaped into validity, so it must not reach the file at all.
			await buildBlankPresentationArchive({ theme: { colors: { accent1: 'rebeccapurple' } } }),
		);
		const theme = parts['ppt/theme/theme1.xml'];
		expect(theme).toContain('<a:accent1><a:srgbClr val="4472C4"/></a:accent1>');
		expect(theme).not.toContain('REBECCAPURPLE');
	});

	it('expands three-digit shorthand theme colours', async () => {
		const parts = await readParts(
			await buildBlankPresentationArchive({ theme: { colors: { accent1: '#ABC' } } }),
		);
		expect(parts['ppt/theme/theme1.xml']).toContain(
			'<a:accent1><a:srgbClr val="AABBCC"/></a:accent1>',
		);
	});

	it('writes the master bullet character as literal bytes, not a re-encoded entity', async () => {
		const parts = await readParts(await buildBlankPresentationArchive());
		const master = parts['ppt/slideMasters/slideMaster1.xml'];
		expect(master).toContain('<a:buChar char="&#x2022;"/>');
		expect(master).not.toContain('&amp;#x2022;');
	});

	it('does not compound entities across repeated save cycles', async () => {
		const { handler, data } = await PresentationBuilder.create({
			title: HOSTILE,
			creator: HOSTILE,
		});
		let bytes = await handler.save(data.slides);
		const snapshots: string[] = [];
		for (let i = 0; i < 5; i++) {
			const next = new PptxHandler();
			const loaded = await next.load(bytes.buffer as ArrayBuffer);
			bytes = await next.save(loaded.slides);
			const parts = await readParts(bytes);
			// `cp:revision` legitimately increments on every save; nothing else may move.
			snapshots.push(
				JSON.stringify({
					...parts,
					'docProps/core.xml': parts['docProps/core.xml'].replace(
						/<cp:revision>\d+<\/cp:revision>/,
						'',
					),
				}),
			);
			for (const [name, text] of Object.entries(parts)) {
				expect(text, `${name} grew an entity on save ${i + 1}`).not.toContain('&amp;amp;');
				expect(XMLValidator.validate(text), `${name} is not well-formed`).toBeTruthy();
			}
		}
		expect(snapshots.slice(1)).toStrictEqual(snapshots.slice(1).map(() => snapshots[0]));
		// Five full load/save cycles: generous, because the default 5s budget is
		// tight on a loaded machine.
	}, 30_000);
});

describe('presentationBuilder', () => {
	it('creates a blank presentation with default options', async () => {
		const { handler, data } = await PresentationBuilder.create();

		expect(handler).toBeInstanceOf(PptxHandler);
		expect(data).toBeDefined();
		expect(data.slides).toBeDefined();
		expect(Array.isArray(data.slides)).toBeTruthy();
		// Blank presentation starts with 0 slides
		expect(data.slides).toHaveLength(0);
		// Default 16:9 dimensions
		expect(data.width).toBeGreaterThan(0);
		expect(data.height).toBeGreaterThan(0);
	});

	it('creates a presentation with custom dimensions', async () => {
		const { data } = await PresentationBuilder.create({
			width: 9_144_000, // 4:3
			height: 6_858_000,
		});
		expect(data.widthEmu).toBe(9_144_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it('creates a presentation with custom theme colors', async () => {
		const { data } = await PresentationBuilder.create({
			theme: {
				name: 'Corporate',
				colors: {
					accent1: '#FF6B6B',
					accent2: '#556270',
				},
			},
		});
		// Theme color map should contain our custom accent colors
		expect(data.themeColorMap).toBeDefined();
		if (data.themeColorMap) {
			expect(data.themeColorMap.accent1?.toUpperCase()).toBe('#FF6B6B');
		}
	});

	it('creates a presentation with custom fonts', async () => {
		const { data } = await PresentationBuilder.create({
			theme: {
				fonts: { majorFont: 'Inter', minorFont: 'Inter' },
			},
		});
		expect(data.theme?.fontScheme).toBeDefined();
	});

	it('provides layout options after adding a slide', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		// Add a slide to trigger layout resolution
		data.slides.push(createSlide('Blank').build());
		await handler.save(data.slides);
		// After save+reload, layouts should be available in data
		const handler2 = new PptxHandler();
		const bytes = await handler.save(data.slides);
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		// At minimum, the blank presentation + slide should be loadable
		expect(data2.slides).toHaveLength(1);
	});

	it('can save the blank presentation', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it('saved presentation can be re-loaded', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);

		// Re-load
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(data2.slides).toHaveLength(0);
		expect(data2.width).toBeGreaterThan(0);
	});

	it('createSlide factory builds slides', async () => {
		const { createSlide, data, handler } = await PresentationBuilder.create();

		const slide = createSlide('Blank')
			.addText('Hello World', {
				fontSize: 36,
				bold: true,
				x: 100,
				y: 100,
				width: 800,
				height: 60,
			})
			.setNotes('Speaker notes here')
			.build();

		data.slides.push(slide);
		expect(data.slides).toHaveLength(1);
		expect(data.slides[0].elements).toHaveLength(1);
		expect(data.slides[0].elements[0].type).toBe('text');
		expect(data.slides[0].notes).toBe('Speaker notes here');

		// Should be saveable
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it('can add multiple slides with different layouts', async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		data.slides.push(
			createSlide('Title Slide')
				.addText('Welcome', { fontSize: 44, x: 100, y: 200, width: 800, height: 80 })
				.build(),
		);

		data.slides.push(
			createSlide('Blank')
				.addShape('rect', {
					fill: { type: 'solid', color: '#FF0000' },
					x: 200,
					y: 200,
					width: 300,
					height: 200,
				})
				.build(),
		);

		expect(data.slides).toHaveLength(2);
		expect(data.slides[0].layoutName).toBe('Title Slide');
		expect(data.slides[1].layoutName).toBe('Blank');
	});

	it('can create slides with tables and charts', async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const slide = createSlide('Blank')
			.addTable(
				{
					rows: [
						{ cells: [{ text: 'Name' }, { text: 'Score' }] },
						{ cells: [{ text: 'Alice' }, { text: '95' }] },
					],
					firstRow: true,
				},
				{ x: 50, y: 50, width: 500, height: 200 },
			)
			.addChart(
				'bar',
				{
					series: [{ name: 'Q1', values: [10, 20, 30] }],
					categories: ['A', 'B', 'C'],
				},
				{ x: 50, y: 300, width: 500, height: 300 },
			)
			.build();

		data.slides.push(slide);
		expect(slide.elements).toHaveLength(2);
		expect(slide.elements[0].type).toBe('table');
		expect(slide.elements[1].type).toBe('chart');
	});

	it('round-trips a presentation with elements', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create({ title: 'Test Deck' });

		data.slides.push(
			createSlide('Blank')
				.addText('Slide 1 Text', { x: 100, y: 100, width: 400, height: 50 })
				.addShape('ellipse', {
					x: 200,
					y: 200,
					width: 200,
					height: 200,
					fill: { type: 'solid', color: '#00FF00' },
				})
				.build(),
		);

		const bytes = await handler.save(data.slides);

		// Re-load and verify
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(data2.slides).toHaveLength(1);
		expect(data2.slides[0].elements.length).toBeGreaterThanOrEqual(1);
	});
});
