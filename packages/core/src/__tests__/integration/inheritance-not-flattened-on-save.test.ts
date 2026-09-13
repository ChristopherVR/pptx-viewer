import { XMLParser } from 'fast-xml-parser';
/**
 * A save must write what the source AUTHORED, not what the loader RESOLVED.
 *
 * `a:rPr` is a sparse override of the layout/master/theme cascade and `a:pPr`
 * is a sparse override of the shape's `a:lstStyle` and the placeholder's level
 * styles. Both were being re-emitted from the fully resolved model, so a
 * PowerPoint-authored deck came back with every inherited size, colour and
 * typeface pinned onto its runs and every inherited alignment and margin
 * pinned onto its paragraphs. Nothing looks wrong until the user re-themes or
 * re-lays-out the deck and the text refuses to follow.
 *
 * The corpus deck below is the project's own COM-authored fixture, and its
 * title run is verbatim `<a:rPr lang="en-US"/>`: it authors NOTHING, so a
 * faithful save must not invent anything for it either.
 *
 * These assertions are on the raw saved XML on purpose. A model-level
 * round-trip cannot see this defect at all, because a flattened deck reloads
 * to exactly the same resolved values - which is why it survived a 10,000-test
 * suite and a corpus round-trip harness.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types';
import { hasTextProperties } from '../../core/types';
import { readCorpusFixture } from './real-world-corpus-helpers';

const FIXTURE = 'animations-transitions-multislide.pptx';

describe('edited inherited placeholder transforms', () => {
	const fixture = 'master-layout-inheritance-fills.pptx';
	const cases: Array<[string, (element: PptxElement) => Partial<PptxElement>]> = [
		['move', (element) => ({ x: element.x + 40, y: element.y + 20 })],
		['resize', (element) => ({ width: element.width + 80, height: element.height + 30 })],
		['rotation', () => ({ rotation: 30 })],
		['horizontal flip', () => ({ flipHorizontal: true })],
		['vertical flip', () => ({ flipVertical: true })],
		['zero width', () => ({ width: 0 })],
		[
			'move, resize, rotate and flip together',
			() => ({ x: 200, y: 138, width: 1000, height: 251, rotation: 30, flipHorizontal: true }),
		],
	];

	it('persists a picture placeholder edit without changing its inherited layout', async () => {
		const zip = await JSZip.loadAsync(readCorpusFixture(fixture));
		const images = await JSZip.loadAsync(readCorpusFixture('ole-embedded-media.pptx'));
		const image = Object.keys(images.files).find((name) => /^ppt\/media\/.*\.png$/u.test(name))!;
		expect(image).toBeDefined();
		zip.file('ppt/media/inherited-picture.png', await images.file(image)!.async('uint8array'));
		const slidePath = 'ppt/slides/slide1.xml';
		const xml = await zip.file(slidePath)!.async('string');
		const title = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/gu)].find((match) =>
			match[0].includes('name="Title 1"'),
		)?.[0];
		expect(title).toBeDefined();
		zip.file(
			slidePath,
			xml.replace(
				title!,
				'<p:pic><p:nvPicPr><p:cNvPr id="999" name="Inherited picture"/><p:cNvPicPr/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rIdInheritedPicture"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr/></p:pic>',
			),
		);
		const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
		zip.file(
			relsPath,
			(await zip.file(relsPath)!.async('string')).replace(
				'</Relationships>',
				'<Relationship Id="rIdInheritedPicture" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/inherited-picture.png"/></Relationships>',
			),
		);
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		if (!contentTypes.includes('Extension="png"')) {
			zip.file(
				'[Content_Types].xml',
				contentTypes.replace(
					'</Types>',
					'<Default Extension="png" ContentType="image/png"/></Types>',
				),
			);
		}
		const handler = new PptxHandler();
		const data = await handler.load(await zip.generateAsync({ type: 'uint8array' }));
		const target = data.slides[0].elements.find((element) => element.name === 'Inherited picture')!;
		expect(target).toMatchObject({ type: 'picture', width: 960, x: 160 });
		expect(target.rawXml?.['p:spPr']).toBe('');
		target.x += 40;
		target.width += 80;
		target.rotation = 30;
		data.slides[0].isDirty = true;
		const saved = await handler.save(data.slides);
		const reader = new PptxHandler();
		const reloaded = await reader.load(saved);
		expect(
			reloaded.slides[0].elements.find((element) => element.name === 'Inherited picture'),
		).toMatchObject({ x: 200, width: 1040, rotation: 30 });
		const picture = reloaded.slides[0].elements.find(
			(element) => element.name === 'Inherited picture',
		)!;
		picture.rotation = 45;
		reloaded.slides[0].isDirty = true;
		const rotated = await new PptxHandler().load(await reader.save(reloaded.slides));
		expect(
			rotated.slides[0].elements.find((element) => element.name === 'Inherited picture'),
		).toMatchObject({ x: 200, width: 1040, rotation: 45 });
	});

	it.each(cases)('persists a %s without rewriting the layout', async (_name, patchFor) => {
		const source = readCorpusFixture(fixture);
		const handler = new PptxHandler();
		const data = await handler.load(source);
		const slide = data.slides[0];
		const target = slide.elements.find((element) => element.name === 'Title 1')!;
		expect(target, 'the committed fixture must contain its inherited title').toBeDefined();
		expect(target.rawXml?.['p:spPr']).toBe('');
		expect(target.width).toBeGreaterThan(0);
		const patch = patchFor(target);
		Object.assign(target, patch);
		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved);
		const actual = reloaded.slides[0].elements.find((element) => element.name === 'Title 1');
		const parser = new XMLParser({ ignoreAttributes: false });
		expect(parser.parse(await partOf(saved, 'ppt/slideLayouts/slideLayout1.xml'))).toStrictEqual(
			parser.parse(await partOf(source, 'ppt/slideLayouts/slideLayout1.xml')),
		);
		expect(actual).toMatchObject(patch);
	});

	it.each([false, true])(
		'preserves combined edits across saves (save rotation first=%s)',
		async (saveRotationFirst) => {
			const handler = new PptxHandler();
			const data = await handler.load(readCorpusFixture(fixture));
			const target = data.slides[0].elements.find((element) => element.name === 'Title 1')!;
			target.rotation = 30;
			data.slides[0].isDirty = true;
			if (saveRotationFirst) {
				await handler.save(data.slides);
			}
			const patch = {
				x: 200,
				y: 138,
				width: 1000,
				height: 251,
				rotation: 30,
				flipHorizontal: true,
			};
			Object.assign(target, patch);
			const saved = await handler.save(data.slides);
			const secondSave = await handler.save(data.slides);
			for (const bytes of [saved, secondSave]) {
				const reloaded = await new PptxHandler().load(bytes);
				expect(
					reloaded.slides[0].elements.find((element) => element.name === 'Title 1'),
				).toMatchObject(patch);
			}
		},
	);

	it('resets inherited rotation and flips through repeated saves', async () => {
		const zip = await JSZip.loadAsync(readCorpusFixture(fixture));
		const layoutPath = 'ppt/slideLayouts/slideLayout1.xml';
		const xml = await zip.file(layoutPath)!.async('string');
		const title = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/gu)].find((match) =>
			match[0].includes('type="ctrTitle"'),
		)?.[0];
		expect(title).toContain('<a:xfrm>');
		zip.file(
			layoutPath,
			xml.replace(title!, title!.replace('<a:xfrm>', '<a:xfrm rot="2700000" flipH="1" flipV="1">')),
		);
		const handler = new PptxHandler();
		const data = await handler.load(await zip.generateAsync({ type: 'uint8array' }));
		const target = data.slides[0].elements.find((element) => element.name === 'Title 1')!;
		expect(target).toMatchObject({ rotation: 45, flipHorizontal: true, flipVertical: true });
		expect(target.rawXml?.['p:spPr']).toBe('');
		// Autosave may already have materialized the override while it was true.
		Object.assign(target, {
			rotation: 45,
			flipHorizontal: true,
			flipVertical: true,
			x: target.x + 1,
		});
		data.slides[0].isDirty = true;
		await handler.save(data.slides);
		Object.assign(target, { rotation: 0, flipHorizontal: false, flipVertical: false });
		data.slides[0].isDirty = true;
		const reader = new PptxHandler();
		const reloaded = await reader.load(await handler.save(data.slides));
		expect(reloaded.slides[0].elements.find((element) => element.name === 'Title 1')).toMatchObject(
			{
				rotation: 0,
				flipHorizontal: false,
				flipVertical: false,
			},
		);
		reloaded.slides[0].isDirty = true;
		const reopened = reloaded.slides[0].elements.find((element) => element.name === 'Title 1')!;
		Object.assign(reopened, { flipHorizontal: true, flipVertical: true });
		await reader.save(reloaded.slides);
		Object.assign(reopened, { flipHorizontal: false, flipVertical: false });
		const second = await new PptxHandler().load(await reader.save(reloaded.slides));
		expect(second.slides[0].elements.find((element) => element.name === 'Title 1')).toMatchObject({
			rotation: 0,
			flipHorizontal: false,
			flipVertical: false,
		});
	});

	it.each([false, true])(
		'does not mistake scaled group coordinates for an edit (text-only=%s)',
		async (editText) => {
			const zip = await JSZip.loadAsync(readCorpusFixture(fixture));
			const slidePath = 'ppt/slides/slide1.xml';
			const xml = await zip.file(slidePath)!.async('string');
			const title = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/gu)].find((match) =>
				match[0].includes('name="Title 1"'),
			)?.[0];
			expect(title).toBeDefined();
			zip.file(
				slidePath,
				xml.replace(
					title!,
					`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="999" name="Scaled group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="12192000" cy="6858000"/><a:chOff x="0" y="0"/><a:chExt cx="6096000" cy="3429000"/></a:xfrm></p:grpSpPr>${title!}</p:grpSp>`,
				),
			);
			const handler = new PptxHandler();
			const data = await handler.load(await zip.generateAsync({ type: 'uint8array' }));
			const group = data.slides[0].elements.find((element) => element.type === 'group');
			expect(group?.type).toBe('group');
			if (group?.type !== 'group') {
				throw new Error('Expected group');
			}
			const target = group.children.find((element) => element.name === 'Title 1')!;
			expect(target.rawXml?.['p:spPr']).toBe('');
			expect(target.width).toBe(1920);
			if (target.type !== 'shape' && target.type !== 'text') {
				throw new Error('Expected text');
			}
			if (editText) {
				target.text = 'Changed grouped text';
				target.textSegments = [{ text: target.text, style: target.textStyle ?? {} }];
			}
			data.slides[0].isDirty = true;
			const saved = await partOf(await handler.save(data.slides), slidePath);
			const savedTitle = [...saved.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/gu)].find((match) =>
				match[0].includes('name="Title 1"'),
			)?.[0];
			if (editText) {
				expect(savedTitle).toContain('Changed grouped text');
			}
			expect(savedTitle).not.toContain('<a:xfrm');
		},
	);

	it.each([false, true])(
		'keeps a placeholder inherited on a text-only=%s save',
		async (editText) => {
			const handler = new PptxHandler();
			const data = await handler.load(readCorpusFixture(fixture));
			const slide = data.slides[0];
			const target = slide.elements.find((element) => element.name === 'Title 1')!;
			expect(target.rawXml?.['p:spPr']).toBe('');
			if (editText && (target.type === 'text' || target.type === 'shape')) {
				target.text = 'Changed title text';
				target.textSegments = [{ text: target.text, style: target.textStyle ?? {} }];
			}
			slide.isDirty = true;
			const saved = await handler.save(data.slides);
			const xml = await partOf(saved, 'ppt/slides/slide1.xml');
			const title = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/gu)].find((match) =>
				match[0].includes('name="Title 1"'),
			)?.[0];
			expect(title).toBeDefined();
			expect(title).not.toContain('<a:xfrm');
			if (editText) {
				expect(title).toContain('Changed title text');
			}
		},
	);
});

describe('text-only commits do not become element-level style edits', () => {
	it.each([{}, { fontSize: 32 }, { color: '#FF0000' }, { bold: true }])(
		'preserves native run formatting while honoring explicit edit %j',
		async (styleEdit) => {
			const {
				handler: seedHandler,
				data: seed,
				createSlide,
			} = await PptxHandler.createBlank({ initialSlideCount: 0 });
			seed.slides.push(
				createSlide('Blank')
					.addText('Placeholder', { x: 40, y: 40, width: 300, height: 120 })
					.build(),
			);
			const zip = await JSZip.loadAsync(await seedHandler.save(seed.slides));
			const part = 'ppt/slides/slide1.xml';
			const xml = await zip.file(part)!.async('string');
			const paragraphs = ['First', 'Second']
				.map(
					(body) =>
						'<a:p><a:pPr><a:buAutoNum type="romanUcPeriod" startAt="3"/></a:pPr>' +
						'<a:r><a:rPr sz="1650"><a:solidFill><a:srgbClr val="123456"/></a:solidFill>' +
						`<a:latin typeface="Arial"/></a:rPr><a:t>${body}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`,
				)
				.join('');
			zip.file(
				part,
				xml.replace(
					/<p:txBody>[\s\S]*?<\/p:txBody>/u,
					'<p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr>' +
						'<a:solidFill><a:srgbClr val="123456"/></a:solidFill>' +
						`</a:defRPr></a:lvl1pPr></a:lstStyle>${paragraphs}</p:txBody>`,
				),
			);
			const source = await zip.generateAsync({ type: 'arraybuffer' });
			const handler = new PptxHandler();
			const data = await handler.load(source);
			const element = data.slides[0].elements[0];
			if (!hasTextProperties(element)) {
				throw new Error('expected text element');
			}
			expect(element.textStyle?.fontSize).toBe(24);
			// A plain-text commit preserves body run sizes and copies the previous
			// paragraph's run size onto separators. This can make all segments
			// uniform without editing the inherited element-level default at all.
			const textSegments = element.textSegments!.map((segment) => ({
				...segment,
				text: segment.text === 'First' ? 'First edited' : segment.text,
				style: { ...segment.style, fontSize: 22 },
			}));
			const edited = {
				...element,
				text: 'First edited\nSecond',
				textSegments,
				textStyle: { ...element.textStyle, ...styleEdit },
			};
			const saved = await handler.save([{ ...data.slides[0], isDirty: true, elements: [edited] }]);
			const reloaded = await new PptxHandler().load(
				saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
			);
			const result = reloaded.slides[0].elements[0];
			if (!hasTextProperties(result)) {
				throw new Error('expected reloaded text');
			}
			const bodies = result.textSegments!.filter(
				(segment) => segment.text === 'First edited' || segment.text === 'Second',
			);
			expect(bodies.map((segment) => segment.text)).toStrictEqual(['First edited', 'Second']);
			for (const body of bodies) {
				expect(body.style).toMatchObject({
					fontSize: 22,
					fontFamily: 'Arial',
					color: '#123456',
					...styleEdit,
				});
			}
			const savedXml = await partOf(saved, part);
			expect(savedXml).toContain('First edited');
			expect(savedXml).toContain(`sz="${'fontSize' in styleEdit ? '2400' : '1650'}"`);
		},
	);
});

/** Count non-overlapping occurrences of a literal token. */
function count(haystack: string, needle: string): number {
	let total = 0;
	let index = 0;
	for (;;) {
		const found = haystack.indexOf(needle, index);
		if (found < 0) {
			return total;
		}
		total += 1;
		index = found + needle.length;
	}
}

async function partOf(bytes: ArrayBuffer | Uint8Array, part: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const file = zip.file(part);
	expect(file).toBeTruthy();
	return await file!.async('string');
}

describe('a save does not flatten inheritance into the slide', () => {
	let before = '';
	let after = '';

	beforeAll(async () => {
		const source = readCorpusFixture(FIXTURE);
		before = await partOf(source, 'ppt/slides/slide1.xml');

		const handler = new PptxHandler();
		const data = await handler.load(source);
		// The slide-level fingerprint fast path passes an untouched slide through
		// verbatim, which would make this test prove nothing. Marking the slides
		// dirty is the case that matters anyway: the user edits ONE slide and
		// every run on it is re-serialized.
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		after = await partOf(await handler.save(data.slides), 'ppt/slides/slide1.xml');
	}, 30_000);

	it('leaves the source verbatim as the baseline this test is measured against', () => {
		// Guards the fixture itself: if PowerPoint ever re-authors it with
		// explicit run properties, the assertions below would pass vacuously.
		expect(before).toContain('<a:rPr lang="en-US"/>');
		expect(count(before, '<a:latin')).toBe(0);
		expect(count(before, '<a:solidFill')).toBe(0);
	});

	it('invents no typeface for a run that authored none', () => {
		// Before the fix: `<a:latin typeface="Aptos Display"/>`, resolved off the
		// theme's major font and therefore no longer following it.
		expect(count(after, '<a:latin')).toBe(0);
		expect(count(after, '<a:ea ')).toBe(0);
		expect(count(after, '<a:cs ')).toBe(0);
	});

	it('invents no size or colour for a run that authored none', () => {
		// Before the fix: `sz="6000"` plus
		// `<a:solidFill><a:srgbClr val="000000"/></a:solidFill>`.
		expect(count(after, 'sz="')).toBeLessThanOrEqual(count(before, 'sz="'));
		expect(count(after, '<a:rPr sz=')).toBe(0);
		expect(after).not.toContain('<a:srgbClr val="000000"/></a:solidFill>');
	});

	it('invents no paragraph geometry for a paragraph that authored none', () => {
		// Before the fix: every `a:p` gained `algn`, `marL`, `indent`, an
		// `a:lnSpc` and an `a:spcBef` resolved from the master's `p:bodyStyle`,
		// which then OVERRODE that master for good.
		for (const token of ['algn="', 'marL="', 'indent="', '<a:lnSpc', '<a:spcBef']) {
			expect(`${token}:${count(after, token) <= count(before, token)}`).toBe(`${token}:true`);
		}
	});
});

describe('an edit still reaches the file', () => {
	it('writes an element-level alignment change into a:lstStyle/a:lvl1pPr', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readCorpusFixture(FIXTURE));
		const target = data.slides[0].elements.find(
			(element) =>
				'textStyle' in element && typeof (element as { text?: string }).text === 'string',
		);
		expect(target).toBeTruthy();
		// This is exactly what the shared `alignPatch` / `textAdvancedPatch`
		// panels do: replace `element.textStyle`, and nothing else. Dropping the
		// geometry outright (rather than routing it) would silently discard it.
		const styled = target as { textStyle?: Record<string, unknown>; isDirty?: boolean };
		styled.textStyle = { ...(styled.textStyle ?? {}), align: 'right' };
		data.slides[0].isDirty = true;

		const saved = await partOf(await handler.save(data.slides), 'ppt/slides/slide1.xml');
		expect(saved).toContain('<a:lstStyle><a:lvl1pPr algn="r"');
	}, 30_000);

	it('still writes a run style the user changed', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readCorpusFixture(FIXTURE));
		const target = data.slides[0].elements.find(
			(element) =>
				'textStyle' in element && typeof (element as { text?: string }).text === 'string',
		) as { textStyle?: Record<string, unknown> } | undefined;
		expect(target).toBeTruthy();
		// An editor replaces `element.textStyle` and knows nothing about the
		// authored / inherited split, so "differs from the recorded baseline" is
		// what has to make the value writable again. Without that arm the gate
		// would be indistinguishable from simply never writing run properties.
		target!.textStyle = {
			...(target!.textStyle ?? {}),
			fontFamily: 'Courier New',
			color: '#FF0000',
		};
		data.slides[0].isDirty = true;

		const saved = await partOf(await handler.save(data.slides), 'ppt/slides/slide1.xml');
		expect(saved).toContain('<a:latin typeface="Courier New"');
		expect(saved).toContain('<a:srgbClr val="FF0000"');
	}, 30_000);
});
