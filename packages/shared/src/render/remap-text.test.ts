import JSZip from 'jszip';
import { hasTextProperties, PptxHandler, PresentationBuilder } from 'pptx-viewer-core';
import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { resolveParagraphBullet } from './bullet-list';
import { decodeDelta, encodeSegmentsToDelta } from './collaboration-text-codec';
import { textStylePatch } from './inspector-helpers';
import { remapTextToSegments } from './remap-text';
import { buildParagraphs } from './text-paragraphs';

const asBuffer = (bytes: Uint8Array): ArrayBuffer =>
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

async function paragraphXml(bytes: Uint8Array, body: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const paragraph = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/gu)].find((match) =>
		match[0].includes(`>${body}<`),
	);
	expect(paragraph, `missing native paragraph ${body}`).toBeDefined();
	return paragraph![0].match(/<a:pPr\b[\s\S]*?<\/a:pPr>/u)?.[0] ?? '';
}

describe('remapped paragraph provenance save/reload', () => {
	it.each([
		[
			{ autoNumType: 'romanUcPeriod', autoNumStartAt: 3 },
			['III.', 'III.', 'IV.', 'V.', 'IV.'],
			'a:buAutoNum',
		],
		[
			{ char: '◆', fontFamily: 'Arial', color: '#D14A24', sizePercent: 75 },
			['◆', '◆', '◆', '◆', '◆'],
			'a:buChar',
		],
		[
			{
				imageRelId: 'rIdBullet',
				imageDataUrl:
					'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0eoAAAAASUVORK5CYII=',
			},
			['•', '•', '•', '•', '•'],
			'a:buBlip',
		],
	] as const)(
		'continues the preceding nested list when inserting into a loaded list (%j)',
		async (bulletInfo, markers, nativeBullet) => {
			const { handler: seedHandler, data: seed, createSlide } = await PresentationBuilder.create();
			const slide = createSlide('Blank')
				.addText('Parent\nNested\nNext nested\nLast parent')
				.build();
			const element = slide.elements[0];
			if (!hasTextProperties(element)) {
				throw new Error('expected text');
			}
			const bodies = ['Parent', 'Nested', 'Next nested', 'Last parent'];
			element.textSegments = bodies.flatMap((text, index): TextSegment[] => [
				...(index ? [breakSeg()] : []),
				{
					text,
					style: { fontSize: 22, fontFamily: 'Arial' },
					bulletInfo,
					paragraphLevel: index === 1 || index === 2 ? 1 : 0,
					paragraphProperties: { paragraphSpacingAfter: 6 + index * 4, lineSpacing: 1.2 },
					endParaRunProperties: { '@_sz': '1650' },
				},
			]);
			seed.slides.push(slide);
			let initial = await seedHandler.save(seed.slides);
			if ('imageDataUrl' in bulletInfo) {
				const zip = await JSZip.loadAsync(initial);
				const relPath = 'ppt/slides/_rels/slide1.xml.rels';
				const relationships = await zip.file(relPath)!.async('string');
				zip.file(
					relPath,
					relationships.replace(
						'</Relationships>',
						'<Relationship Id="rIdBullet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bullet.png"/></Relationships>',
					),
				);
				zip.file('ppt/media/bullet.png', bulletInfo.imageDataUrl.split(',')[1], { base64: true });
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
				initial = await zip.generateAsync({ type: 'uint8array' });
			}
			const handler = new PptxHandler();
			const loaded = await handler.load(asBuffer(initial));
			const source = loaded.slides[0].elements[0];
			if (!hasTextProperties(source)) {
				throw new Error('expected loaded text');
			}
			const text = 'Parent\nNested\nNew middle\nNext nested\nLast parent';
			const edited = {
				...source,
				text,
				textSegments: remapTextToSegments(text, source.textSegments, source.textStyle),
			};
			const saved = await handler.save([
				{ ...loaded.slides[0], isDirty: true, elements: [edited] },
			]);
			const reloaded = await new PptxHandler().load(asBuffer(saved));
			const result = reloaded.slides[0].elements[0];
			if (!hasTextProperties(result)) {
				throw new Error('expected reloaded text');
			}
			expect(
				buildParagraphs(edited).map(
					(item) => item.bulletPicture?.fallbackMarker ?? item.bulletMarker,
				),
			).toStrictEqual(markers);
			expect(
				buildParagraphs(result).map(
					(item) => item.bulletPicture?.fallbackMarker ?? item.bulletMarker,
				),
			).toStrictEqual(markers);
			if (nativeBullet === 'a:buBlip') {
				const originalPicture = buildParagraphs(source)[1].bulletPicture;
				expect(originalPicture?.imageRelId).toBe('rIdBullet');
				expect(buildParagraphs(result)[2].bulletPicture?.imageRelId).toBe(
					originalPicture?.imageRelId,
				);
				const savedZip = await JSZip.loadAsync(saved);
				const originalZip = await JSZip.loadAsync(initial);
				await expect(savedZip.file('ppt/media/bullet.png')!.async('base64')).resolves.toBe(
					await originalZip.file('ppt/media/bullet.png')!.async('base64'),
				);
				await expect(
					savedZip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string'),
				).resolves.toContain('Id="rIdBullet"');
			}
			const insertedProperties = await paragraphXml(saved, 'New middle');
			expect(insertedProperties).toContain('lvl="1"');
			expect(insertedProperties).toContain(nativeBullet);
			expect(insertedProperties).not.toContain('a:spcAft');
			for (const body of bodies) {
				await expect(paragraphXml(saved, body)).resolves.toBe(await paragraphXml(initial, body));
			}
		},
		30_000,
	);

	it.each([
		['First\nInserted\nLast', false],
		['Last', false],
		['First\nInserted\nLast', true],
		['Last', true],
	] as const)(
		'preserves surviving paragraph XML after %s (numbered=%s)',
		async (text, numbered) => {
			const { handler: seedHandler, data: seed, createSlide } = await PresentationBuilder.create();
			const slide = createSlide('Blank')
				.addText('First\nLast', { x: 40, y: 40, width: 300, height: 160 })
				.build();
			const element = slide.elements[0];
			if (!hasTextProperties(element)) {
				throw new Error('expected text');
			}
			const paragraph = (body: string, after: number): TextSegment => ({
				text: body,
				style: { fontSize: 20, fontFamily: 'Arial', color: '#CC6600' },
				bulletInfo: {
					...(numbered ? { autoNumType: 'romanUcPeriod', autoNumStartAt: 4 } : { char: '◆' }),
					fontFamily: 'Arial',
					color: '#CC6600',
				},
				paragraphLevel: 1,
				paragraphProperties: {
					paragraphSpacingBefore: 10,
					paragraphSpacingAfter: after,
					lineSpacing: 1.25,
				},
				endParaRunProperties: { '@_sz': '2000' },
			});
			element.textSegments = [
				paragraph('First', 14),
				{ text: '\n', style: {}, isParagraphBreak: true },
				paragraph('Last', 5),
			];
			seed.slides.push(slide);
			const initial = await seedHandler.save(seed.slides);
			const handler = new PptxHandler();
			const loaded = await handler.load(asBuffer(initial));
			const source = loaded.slides[0].elements[0];
			if (!hasTextProperties(source)) {
				throw new Error('expected loaded text');
			}
			const sourceLast = source.textSegments?.find((segment) => segment.text === 'Last');
			const edited = {
				...source,
				text,
				textSegments: remapTextToSegments(text, source.textSegments, source.textStyle),
			};
			const saved = await handler.save([
				{ ...loaded.slides[0], isDirty: true, elements: [edited] },
			]);
			const originalProperties = await paragraphXml(initial, 'Last');
			expect(originalProperties).toContain('a:spcAft');
			expect(originalProperties).toContain(numbered ? 'a:buAutoNum' : 'a:buChar');
			await expect(paragraphXml(saved, 'Last')).resolves.toBe(originalProperties);
			const reloaded = await new PptxHandler().load(asBuffer(saved));
			const result = reloaded.slides[0].elements[0];
			if (!hasTextProperties(result)) {
				throw new Error('expected reloaded text');
			}
			expect(result.textSegments?.find((segment) => segment.text === 'Last')?.style).toStrictEqual(
				sourceLast?.style,
			);
			const bodies = result.textSegments
				?.filter((segment) => !segment.bulletInfo && segment.text !== '\n')
				.map((segment) => segment.text);
			expect(bodies).toStrictEqual(text.split('\n'));
			expect(buildParagraphs(result).map((item) => item.bulletMarker)).toStrictEqual(
				buildParagraphs(edited).map((item) => item.bulletMarker),
			);
		},
		30_000,
	);
});

function seg(text: string, style: TextStyle = {}): TextSegment {
	return { text, style };
}

function breakSeg(style: TextStyle = {}): TextSegment {
	return { text: '\n', style, isParagraphBreak: true };
}

describe('remapTextToSegments', () => {
	describe('inserted paragraph list context', () => {
		const groups = (segments: TextSegment[]) => {
			const result: TextSegment[][] = [[]];
			for (const segment of segments) {
				if (segment.isParagraphBreak || segment.text === '\n') {
					result.push([]);
				} else {
					result.at(-1)!.push(segment);
				}
			}
			return result;
		};

		it.each([
			{ fieldType: 'slidenum', fieldGuid: '{field-id}' },
			{ equationXml: { 'm:oMath': {} }, equationNumber: '1' },
		])('does not turn newly inserted body text into a donor field or equation (%j)', (metadata) => {
			const source: TextSegment[] = [
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' }, paragraphLevel: 1 },
				{ text: '3', style: { bold: true }, ...metadata },
				breakSeg(),
				seg('Suffix'),
			];
			const result = groups(remapTextToSegments('3\nNew text\nSuffix', source, {}));
			expect(result[0]).toStrictEqual(source.slice(0, 2));
			expect(
				result[1]
					.slice(1)
					.map((segment) => segment.text)
					.join(''),
			).toBe('New text');
			for (const segment of result[1]) {
				expect(segment.fieldType).toBeUndefined();
				expect(segment.fieldGuid).toBeUndefined();
				expect(segment.equationXml).toBeUndefined();
				expect(segment.equationNumber).toBeUndefined();
			}
		});

		it('keeps a literal marker-like prefix in newly inserted list content', () => {
			const source: TextSegment[] = [
				{
					text: 'III.',
					style: {},
					bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
					paragraphLevel: 1,
				},
				seg('Nested'),
				breakSeg(),
				seg('Unrelated'),
			];
			const result = groups(
				remapTextToSegments('Nested\nIII. Literal body\nUnrelated', source, {}),
			);
			expect(result[1].map((segment) => segment.text)).toStrictEqual(['IV.', 'III. Literal body']);
		});

		it('does not invent a runtime ordinal from an unknown-index preceding paragraph', () => {
			const bulletInfo = { autoNumType: 'arabicPeriod', autoNumStartAt: 1 };
			const source: TextSegment[] = [
				{ text: '1.', style: {}, bulletInfo, paragraphLevel: 2 },
				breakSeg(),
				seg('Suffix'),
			];
			const result = groups(remapTextToSegments('1.\n1. Literal\nSuffix', source, {}));
			expect(result[0][0]).toStrictEqual(source[0]);
			expect(result[1].map((segment) => segment.text)).toStrictEqual(['1. Literal']);
			expect(result[1][0].bulletInfo).toStrictEqual(bulletInfo);
			expect(result[1][0].paragraphLevel).toBeUndefined();
		});

		it.each([
			[
				'Parent\nNested\nNew one\nNew two\nNext\nLast',
				[0, 1, 1, 1, 1, 0],
				['III.', 'III.', 'IV.', 'V.', 'VI.', 'IV.'],
			],
			['Parent\nNes\nted\nNext\nLast', [0, 1, 1, 1, 0], ['III.', 'III.', 'IV.', 'V.', 'IV.']],
			['Parent\nNested\nNext\nNew\nLast', [0, 1, 1, 1, 0], ['III.', 'III.', 'IV.', 'V.', 'IV.']],
			['Parent\nNested\nNext\nLast\nNew', [0, 1, 1, 0, 0], ['III.', 'III.', 'IV.', 'IV.', 'V.']],
		] as const)(
			'continues local nesting for insertion, multiline paste, split and append (%s)',
			(text, levels, markers) => {
				const source = ['Parent', 'Nested', 'Next', 'Last'].flatMap(
					(body, index): TextSegment[] => [
						...(index ? [breakSeg()] : []),
						{
							text: index < 2 ? 'III.' : 'IV.',
							style: {},
							paragraphLevel: index === 1 || index === 2 ? 1 : 0,
							bulletInfo: {
								autoNumType: 'romanUcPeriod',
								autoNumStartAt: 3,
								paragraphIndex: index < 2 ? 0 : 1,
							},
						},
						seg(body),
					],
				);
				const result = groups(remapTextToSegments(text, source, {}));
				expect(result.map((paragraph) => paragraph[0].paragraphLevel)).toStrictEqual(levels);
				expect(
					result.map((paragraph) => resolveParagraphBullet(paragraph[0])?.marker),
				).toStrictEqual(markers);
				expect(
					result.map((paragraph) =>
						paragraph
							.slice(1)
							.map((segment) => segment.text)
							.join(''),
					),
				).toStrictEqual(text.split('\n'));
			},
		);

		it('does not borrow a following numbering restart or change its authored definition', () => {
			const first: TextSegment = {
				text: 'III.',
				style: {},
				paragraphLevel: 1,
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
			};
			const last: TextSegment = {
				text: 'g)',
				style: {},
				paragraphLevel: 1,
				bulletInfo: { autoNumType: 'alphaLcParenR', autoNumStartAt: 7, paragraphIndex: 0 },
				paragraphProperties: { paragraphSpacingAfter: 20 },
			};
			const result = groups(
				remapTextToSegments(
					'First\nNew\nRestart',
					[first, seg('First'), breakSeg(), last, seg('Restart')],
					{},
				),
			);
			expect(result.map((paragraph) => resolveParagraphBullet(paragraph[0])?.marker)).toStrictEqual(
				['III.', 'IV.', 'g)'],
			);
			expect(result[2][0]).toStrictEqual(last);
		});

		it.each([
			{ char: '◆', fontFamily: 'Arial', color: '#D14A24', sizePercent: 75 },
			{ imageRelId: 'rIdBullet', imageDataUrl: 'data:image/png;base64,AQ==' },
		])(
			'continues the preceding bullet definition and level without paragraph metadata (%j)',
			(bulletInfo) => {
				const source: TextSegment[] = [
					{
						text: 'Nested',
						style: { fontSize: 22 },
						bulletInfo,
						paragraphLevel: 2,
						paragraphProperties: { paragraphSpacingAfter: 12 },
						endParaRunProperties: { '@_sz': '2200' },
					},
					breakSeg(),
					{ text: 'Unrelated', style: {}, bulletInfo: { char: '»' }, paragraphLevel: 0 },
				];
				const snapshot = structuredClone(source);
				const result = groups(
					remapTextToSegments('Nested\nNew one\nNew two\nUnrelated', source, {}),
				);
				for (const index of [1, 2]) {
					expect(result[index][0].bulletInfo).toStrictEqual(bulletInfo);
					expect(result[index][0].paragraphLevel).toBe(2);
					expect(result[index][0].paragraphProperties).toBeUndefined();
					expect(result[index][0].endParaRunProperties).toBeUndefined();
					expect(result[index][0].paragraphInsertionStyle).toBeUndefined();
				}
				expect(source).toStrictEqual(snapshot);
			},
		);

		it.each([
			{ bulletInfo: undefined, style: {} },
			{ bulletInfo: { none: true }, style: {} },
			{
				bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 0 },
				style: { listType: 'none' as const },
			},
		])('does not invent a list after plain or suppressed text (%j)', ({ bulletInfo, style }) => {
			const source: TextSegment[] = [
				{ text: 'Plain', style, bulletInfo },
				breakSeg(),
				{
					text: 'Numbered suffix',
					style: {},
					bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 0 },
				},
			];
			const result = groups(
				remapTextToSegments('Plain\n1. Literal new body\nNumbered suffix', source, {}),
			);
			expect(result[1].map((segment) => segment.text).join('')).toBe('1. Literal new body');
			expect(resolveParagraphBullet(result[1][0])).toBeUndefined();
			expect(result[1][0].paragraphLevel).toBeUndefined();
		});
	});

	it('moves a runless blank terminator with its aligned source and consumes its style on later typing', () => {
		const hint = { fontFamily: 'Courier New', fontSize: 40 };
		const original = [
			seg('First'),
			breakSeg(),
			{ ...breakSeg(), paragraphInsertionStyle: hint },
			seg('Last'),
		];
		const moved = remapTextToSegments('Inserted\nFirst\n\nLast', original, {});
		expect(moved[4]).toMatchObject({ text: '\n', paragraphInsertionStyle: hint });
		expect(moved.filter((segment) => segment.paragraphInsertionStyle)).toHaveLength(1);
		const typed = remapTextToSegments('Inserted\nFirst\nTyped\nLast', moved, {});
		expect(typed.find((segment) => segment.text === 'Typed')?.style).toStrictEqual(hint);
		expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
	});

	describe('empty paragraph insertion formatting', () => {
		const insertion: TextStyle = {
			fontFamily: 'Courier New',
			fontSize: 40,
			color: '#007000',
			bold: true,
			authoredRunStyle: { fontFamily: 'Courier New', fontSize: 40, color: '#007000', bold: true },
			inheritedRunStyle: { fontFamily: 'Calibri', fontSize: 24 },
		};

		it('ignores stale insertion hints on a nonempty body run', () => {
			const result = remapTextToSegments(
				'Edited',
				[{ text: 'Body', style: { fontSize: 18 }, paragraphInsertionStyle: insertion }],
				{},
			);
			expect(result).toHaveLength(1);
			expect(result[0].style.fontSize).toBe(18);
		});

		it.each([
			['plain', undefined, ''],
			['character', { char: '◆' }, '◆ '],
			['numbered', { autoNumType: 'romanUcPeriod', paragraphIndex: 0 }, 'I.'],
			['picture', { imageRelId: 'rId7' }, ''],
		] as const)(
			'uses end formatting for typed %s body, leaving marker styling intact',
			(_name, bulletInfo, marker) => {
				const source: TextSegment = {
					text: marker,
					style: { fontSize: 18, fontFamily: 'Symbol' },
					...(bulletInfo ? { bulletInfo } : {}),
					paragraphInsertionStyle: insertion,
					endParaRunProperties: { '@_sz': '3000' },
					paragraphProperties: { paragraphSpacingAfter: 10 },
				};
				const original = [source];
				const result = remapTextToSegments('Typed', original, {});
				expect(result.at(-1)).toMatchObject({ text: 'Typed', style: insertion });
				expect(result.at(-1)?.paragraphInsertionStyle).toBeUndefined();
				expect(result[0].endParaRunProperties).toStrictEqual(source.endParaRunProperties);
				if (bulletInfo) {
					expect(result[0].style).toStrictEqual(source.style);
				}
				expect(remapTextToSegments('', original, {})).toStrictEqual(original);
				expect(source.paragraphInsertionStyle).toBe(insertion);
				const restyled = result.map((segment) =>
					segment.text === 'Typed'
						? { ...segment, style: { ...segment.style, fontSize: 52 } }
						: segment,
				);
				expect(remapTextToSegments('Typed again', restyled, {}).at(-1)?.style.fontSize).toBe(52);
				const appended = remapTextToSegments('\nNew', original, {});
				expect(appended.at(-1)?.style.fontFamily).not.toBe('Courier New');
				expect(appended.at(-1)?.paragraphInsertionStyle).toBeUndefined();
			},
		);

		it('keeps an unchanged runless middle paragraph on its terminator', () => {
			const terminator: TextSegment = {
				...breakSeg(),
				paragraphInsertionStyle: insertion,
				endParaRunProperties: { '@_sz': '3000' },
			};
			const original = [seg('Before'), breakSeg(), terminator, seg('After')];
			const unchanged = remapTextToSegments('Changed\n\nAfter', original, {});
			expect(unchanged.filter((segment) => segment.text === '')).toHaveLength(0);
			expect(unchanged[2]).toStrictEqual(terminator);
			const typed = remapTextToSegments('Before\nTyped\nAfter', original, {});
			expect(typed.find((segment) => segment.text === 'Typed')?.style).toStrictEqual(insertion);
			expect(typed.find((segment) => segment.text === 'Typed')?.endParaRunProperties).toStrictEqual(
				terminator.endParaRunProperties,
			);
		});
	});

	describe('empty paragraph native save/reload', () => {
		it.each(
			[
				['plain', ''],
				['character', '<a:buChar char="◆"/>'],
				['numbered', '<a:buAutoNum type="romanUcPeriod"/>'],
				['picture', '<a:buBlip><a:blip r:embed="rIdEmptyBullet"/></a:buBlip>'],
			].flatMap(([kind, bulletXml]) =>
				[false, true].map((trailing) => ({ kind, bulletXml, trailing })),
			),
		)(
			'preserves $kind end formatting through a no-op and first typed body (trailing=$trailing)',
			async ({ bulletXml, trailing }) => {
				const {
					handler: seedHandler,
					data: seed,
					createSlide,
				} = await PresentationBuilder.create();
				const suffix = trailing ? '' : '\nAfter';
				seed.slides.push(
					createSlide('Blank')
						.addText(`Before\nPlaceholder${suffix}`, { x: 40, y: 40, width: 300, height: 160 })
						.build(),
				);
				const zip = await JSZip.loadAsync(await seedHandler.save(seed.slides));
				zip.file(
					'ppt/media/empty-bullet.png',
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=',
					{ base64: true },
				);
				const rels = 'ppt/slides/_rels/slide1.xml.rels';
				zip.file(
					rels,
					(await zip.file(rels)!.async('string')).replace(
						'</Relationships>',
						'<Relationship Id="rIdEmptyBullet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/empty-bullet.png"/></Relationships>',
					),
				);
				zip.file(
					'[Content_Types].xml',
					(await zip.file('[Content_Types].xml')!.async('string')).replace(
						'</Types>',
						'<Default Extension="png" ContentType="image/png"/></Types>',
					),
				);
				const part = 'ppt/slides/slide1.xml';
				const initialXml = await zip.file(part)!.async('string');
				const end =
					'<a:endParaRPr sz="3000" b="1"><a:solidFill><a:srgbClr val="007000"/></a:solidFill><a:latin typeface="Courier New"/></a:endParaRPr>';
				zip.file(
					part,
					initialXml.replace(/<a:p>[\s\S]*?<\/a:p>/gu, (paragraph) =>
						paragraph.includes('Placeholder')
							? `<a:p><a:pPr>${bulletXml}</a:pPr>${end}</a:p>`
							: paragraph,
					),
				);
				const input = await zip.generateAsync({ type: 'arraybuffer' });
				for (const mode of ['blank', 'typed', 'formatted-blank', 'formatted-typed']) {
					const typed = mode.endsWith('typed');
					const formatted = mode.startsWith('formatted');
					const updates = { fontFamily: 'Arial', fontSize: 24, bold: false, color: '#000000' };
					const handler = new PptxHandler();
					const loaded = await handler.load(input);
					const target = loaded.slides[0].elements[0];
					if (!hasTextProperties(target)) {
						throw new Error('expected text');
					}
					if (formatted) {
						Object.assign(target, textStylePatch(target, updates));
					}
					target.text = typed ? `Before\nTyped${suffix}` : `Changed\n${suffix}`;
					target.textSegments = remapTextToSegments(
						target.text,
						target.textSegments,
						target.textStyle,
					);
					loaded.slides[0].isDirty = true;
					target.textSegments = decodeDelta(
						encodeSegmentsToDelta(target.textSegments),
					) as unknown as TextSegment[];
					const saved = await handler.save(loaded.slides);
					const savedZip = await JSZip.loadAsync(saved);
					const xml = await savedZip.file(part)!.async('string');
					const middle = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/gu)][1][0];
					if (!formatted) {
						expect(middle).toContain(end.replace(/<([\w:]+)([^>]*)\/>/gu, '<$1$2></$1>'));
					}
					if (!typed) {
						expect(middle).not.toContain('<a:r>');
						if (formatted) {
							const roundtrip = await new PptxHandler().load(
								saved.buffer.slice(
									saved.byteOffset,
									saved.byteOffset + saved.byteLength,
								) as ArrayBuffer,
							);
							const blank = roundtrip.slides[0].elements[0];
							if (!hasTextProperties(blank)) {
								throw new Error('expected text');
							}
							const afterReopen = remapTextToSegments(
								`Before\nTyped${suffix}`,
								blank.textSegments,
								blank.textStyle,
							);
							expect(afterReopen.find((segment) => segment.text === 'Typed')?.style).toMatchObject(
								updates,
							);
						}
					} else {
						const reloaded = await new PptxHandler().load(
							saved.buffer.slice(
								saved.byteOffset,
								saved.byteOffset + saved.byteLength,
							) as ArrayBuffer,
						);
						const element = reloaded.slides[0].elements[0];
						expect(
							hasTextProperties(element) &&
								element.textSegments?.find((segment) => segment.text === 'Typed')?.style,
						).toMatchObject(
							formatted
								? updates
								: {
										fontSize: 40,
										fontFamily: 'Courier New',
										bold: true,
										color: '#007000',
									},
						);
					}
				}
			},
		);
	});

	describe('unchanged paragraph provenance', () => {
		it('bounds interior alignment work and retains positional fallback for oversized ambiguous ranges', () => {
			const source: TextSegment[] = Array.from({ length: 102 }, (_, index) => ({
				text: `Body ${index}`,
				style: {},
				paragraphProperties: { paragraphSpacingAfter: index },
			}));
			const original = source.flatMap((item, index) => (index ? [breakSeg(), item] : [item]));
			const edited = [
				'Body 0',
				'Inserted',
				...source.slice(1, -1).map((item) => item.text),
				'Changed end',
			];
			const result = remapTextToSegments(edited.join('\n'), original, {}).filter(
				(item) => !item.isParagraphBreak,
			);
			expect(result.map((item) => item.text)).toStrictEqual(edited);
			expect(result[0]).toStrictEqual(source[0]);
			expect(result[1].paragraphProperties).toStrictEqual(source[1].paragraphProperties);
			expect(result.at(-1)?.paragraphProperties).toBeUndefined();
		});

		const paragraph = (text: string, index: number): TextSegment =>
			Object.freeze({
				text,
				style: Object.freeze({
					fontSize: 18 + index,
					color: index ? '#009900' : '#cc3300',
					bold: Boolean(index),
				}),
				bulletInfo: Object.freeze({ char: index ? '◆' : '»', fontFamily: 'Arial' }),
				paragraphLevel: index,
				paragraphProperties: Object.freeze({
					paragraphSpacingBefore: 6 + index,
					paragraphSpacingAfter: 14 - index,
					lineSpacing: 1.25,
				}),
				endParaRunProperties: Object.freeze({ '@_sz': String(1800 + index * 100) }),
			});
		const group = (segments: TextSegment[]) => {
			const paragraphs: TextSegment[][] = [[]];
			for (const segment of segments) {
				if (segment.isParagraphBreak || segment.text === '\n') {
					paragraphs.push([]);
				} else {
					paragraphs.at(-1)!.push(segment);
				}
			}
			return paragraphs;
		};

		it('keeps an unchanged suffix after a middle insertion without donating its paragraph metadata', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const result = group(
				remapTextToSegments('First\nInserted\nLast', [first, breakSeg(), last], {}),
			);
			expect(result[0][0]).toStrictEqual(first);
			expect(result[2][0]).toStrictEqual(last);
			expect(result[1][0].paragraphProperties).toBeUndefined();
			expect(result[1][0].endParaRunProperties).toBeUndefined();
			expect(result[1][0].paragraphLevel).toBe(0);
			expect(result[1][0].bulletInfo).toStrictEqual(first.bulletInfo);
		});

		it('keeps surviving rich paragraphs after deleting the first paragraph', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			expect(remapTextToSegments('Last', [first, breakSeg(), last], {})).toStrictEqual([last]);
		});

		it.each(['Fir\nst\nLast', 'Joined\nLast'])(
			'keeps the suffix for split/join text %s',
			(text) => {
				const last = paragraph('Last', 2);
				const source = text.startsWith('Joined')
					? [paragraph('First', 0), breakSeg(), paragraph('Second', 1), breakSeg(), last]
					: [paragraph('First', 0), breakSeg(), last];
				expect(group(remapTextToSegments(text, source, {})).at(-1)![0]).toStrictEqual(last);
			},
		);

		it('matches duplicate body text from the corresponding ends, not the first global match', () => {
			const first = paragraph('Same', 0),
				last = paragraph('Same', 1);
			const result = group(
				remapTextToSegments('Same\nInserted\nSame', [first, breakSeg(), last], {}),
			);
			expect(result[0][0]).toStrictEqual(first);
			expect(result[2][0]).toStrictEqual(last);
			// Deleting an indistinguishable duplicate retains the first prefix deterministically.
			expect(remapTextToSegments('Same', [first, breakSeg(), last], {})).toStrictEqual([first]);
		});

		it('preserves a shifted empty paragraph whose metadata rides its terminator', () => {
			const empty = { ...paragraph('\n', 2), isParagraphBreak: true };
			const last = paragraph('Last', 1);
			const source = [paragraph('First', 0), breakSeg(), empty, last];
			const result = group(remapTextToSegments('First\nInserted\n\nLast', source, {}));
			expect(result[2][0].paragraphProperties).toBe(empty.paragraphProperties);
			expect(result[2][0].paragraphLevel).toBe(2);
			expect(result[3][0]).toStrictEqual(last);
		});

		it('matches body text while retaining a proven dedicated display marker', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const marker = { ...last, text: '◆ ' };
			const body = { text: 'Last', style: { italic: true } };
			const result = group(
				remapTextToSegments('First\nInserted\nLast', [first, breakSeg(), marker, body], {}),
			);
			expect(result[2]).toStrictEqual([marker, body]);
		});

		it('keeps no-op and append-only noninheritance controls', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const source = [first, breakSeg(first.style), last];
			expect(remapTextToSegments('First\nLast', source, {})).toStrictEqual(source);
			const appended = group(remapTextToSegments('First\nLast\nAppended', source, {}));
			expect(appended[1][0]).toStrictEqual(last);
			expect(appended[2][0].paragraphProperties).toBeUndefined();
			expect(appended[2][0].endParaRunProperties).toBeUndefined();
		});

		it('keeps leading and trailing blank paragraph provenance', () => {
			const leading = { ...paragraph('\n', 0), isParagraphBreak: true };
			const trailing = paragraph('', 2);
			const result = group(
				remapTextToSegments('First\n', [leading, paragraph('First', 1), breakSeg(), trailing], {}),
			);
			expect(result[0][0]).toStrictEqual(paragraph('First', 1));
			expect(result[1][0]).toStrictEqual(trailing);
			const inserted = group(
				remapTextToSegments('First\nInserted\n', [paragraph('First', 1), breakSeg(), trailing], {}),
			);
			expect(inserted[2][0]).toStrictEqual(trailing);
		});

		it('retains literal marker-like body text without a proven display-marker index', () => {
			const literal = { ...paragraph('1.', 1), bulletInfo: { autoNumType: 'arabicPeriod' } };
			const result = group(
				remapTextToSegments(
					'First\nInserted\n1.',
					[paragraph('First', 0), breakSeg(), literal],
					{},
				),
			);
			expect(result[2][0]).toStrictEqual(literal);
		});

		it('does not treat a long middle insertion as an appended numbered continuation', () => {
			const marker: TextSegment = {
				text: 'IV.',
				style: {},
				paragraphLevel: 2,
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 0 },
				paragraphProperties: { paragraphSpacingAfter: 12 },
			};
			const source = [paragraph('First', 0), breakSeg(), marker, seg('Last')];
			const result = group(remapTextToSegments('First\nA\nB\nC\nLast', source, {}));
			expect(result[4][0]).toStrictEqual(marker);
			for (const inserted of result.slice(1, 4)) {
				expect(inserted[0].paragraphLevel).toBe(0);
				expect(inserted[0].paragraphProperties).toBeUndefined();
				expect(inserted[0].bulletInfo).toStrictEqual(source[0].bulletInfo);
			}
		});

		it('renumbers a shifted suffix without changing its authored numbering or run metadata', () => {
			const first: TextSegment = {
				text: 'IV.',
				style: { fontSize: 24 },
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 0 },
			};
			const last: TextSegment = {
				...paragraph('V.', 0),
				bulletInfo: { autoNumType: 'romanUcPeriod', autoNumStartAt: 4, paragraphIndex: 1 },
			};
			const source = [first, seg('First'), breakSeg(), last, seg('Last')];
			const deleted = remapTextToSegments('Last', source, {});
			expect(deleted[0]).toStrictEqual({
				...last,
				text: 'IV.',
				bulletInfo: { ...last.bulletInfo, paragraphIndex: 0 },
			});
			const inserted = group(remapTextToSegments('First\nInserted\nLast', source, {}));
			expect(inserted[2][0]).toStrictEqual({
				...last,
				text: 'VI.',
				bulletInfo: { ...last.bulletInfo, paragraphIndex: 2 },
			});
			expect(source[3]).toBe(last);
		});

		it('does not count suppressed paragraphs in a surviving numbered sequence', () => {
			const hidden: TextSegment = {
				text: 'Suppressed',
				style: { listType: 'none' },
				bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
			};
			const marker: TextSegment = {
				text: '2.',
				style: {},
				bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 1 },
			};
			const result = remapTextToSegments(
				'Suppressed\nLast',
				[seg('Heading'), breakSeg(), hidden, breakSeg(), marker, seg('Last')],
				{},
			);
			expect(group(result)[1][0]).toStrictEqual({
				...marker,
				text: '1.',
				bulletInfo: { ...marker.bulletInfo, paragraphIndex: 0 },
			});
			expect(result[0]).toStrictEqual(hidden);
		});

		it('keeps positional fallback in a wholly replaced ambiguous region', () => {
			const first = paragraph('First', 0),
				last = paragraph('Last', 1);
			const result = group(
				remapTextToSegments('New first\nNew last', [first, breakSeg(), last], {}),
			);
			expect(result[0][0]).toStrictEqual({ ...first, text: 'New first' });
			expect(result[1][0]).toStrictEqual({ ...last, text: 'New last' });
		});
	});

	describe('fallback behaviour', () => {
		it('returns single segment with fallback style when no original segments', () => {
			const result = remapTextToSegments('Hello', undefined, { bold: true });
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('Hello');
			expect(result[0].style.bold).toBeTruthy();
		});

		it('returns single segment when original segments array is empty', () => {
			const result = remapTextToSegments('Hello', [], { italic: true });
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('Hello');
			expect(result[0].style.italic).toBeTruthy();
		});

		it('uses empty style when no elementTextStyle provided', () => {
			const result = remapTextToSegments('Hello', undefined, undefined);
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('Hello');
		});
	});

	describe('single paragraph remapping', () => {
		it('preserves styles from original segments', () => {
			const original = [seg('Hello', { bold: true }), seg(' World', { italic: true })];
			const result = remapTextToSegments('Hello World', original, {});
			expect(result).toHaveLength(2);
			expect(result[0].style.bold).toBeTruthy();
			expect(result[1].style.italic).toBeTruthy();
		});

		it('distributes text proportionally across segments', () => {
			const original = [seg('AB', { bold: true }), seg('CDE', { italic: true })];
			const result = remapTextToSegments('XYZWQ', original, {});
			expect(result[0].text).toBe('XY');
			expect(result[1].text).toBe('ZWQ');
		});

		it('handles shorter new text', () => {
			const original = [seg('Hello', { bold: true }), seg(' World', { italic: true })];
			const result = remapTextToSegments('Hi', original, {});
			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result[0].text).toBe('Hi');
			expect(result[0].style.bold).toBeTruthy();
		});

		it('handles empty new text', () => {
			const original = [seg('Hello', { bold: true })];
			const result = remapTextToSegments('', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('');
		});

		it('handles original segments with empty text', () => {
			const original = [seg('', { bold: true })];
			const result = remapTextToSegments('New text', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe('New text');
			expect(result[0].style.bold).toBeTruthy();
		});
	});

	describe('multi-paragraph remapping', () => {
		it('splits new text by newlines and remaps each paragraph', () => {
			const original = [seg('Line 1', { bold: true }), breakSeg(), seg('Line 2', { italic: true })];
			const result = remapTextToSegments('AAA\nBBB', original, {});
			const texts = result.map((s) => s.text);
			expect(texts).toContain('\n');
			expect(result[0].text).toBe('AAA');
			expect(result[0].style.bold).toBeTruthy();
			expect(result[1].isParagraphBreak).toBeTruthy();
			expect(result[2].text).toBe('BBB');
			expect(result[2].style.italic).toBeTruthy();
		});

		it('handles more new paragraphs than original', () => {
			const original = [seg('One', { bold: true })];
			const result = remapTextToSegments('A\nB\nC', original, {});
			const breaks = result.filter((s) => s.isParagraphBreak);
			expect(breaks).toHaveLength(2);
		});

		it('handles fewer new paragraphs than original', () => {
			const original = [
				seg('P1', { bold: true }),
				breakSeg(),
				seg('P2', { italic: true }),
				breakSeg(),
				seg('P3', {}),
			];
			const result = remapTextToSegments('OnlyOne', original, {});
			const breaks = result.filter((s) => s.isParagraphBreak);
			expect(breaks).toHaveLength(0);
			expect(result[0].text).toBe('OnlyOne');
		});
	});

	describe('bullet info preservation', () => {
		it('preserves bulletInfo on the first segment of a paragraph', () => {
			const bulletInfo = { type: 'numbered' };
			const original: TextSegment[] = [{ text: 'Item 1', style: { bold: true }, bulletInfo }];
			const result = remapTextToSegments('New item', original, {});
			expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
		});

		it.each(['1.Item edited', '1. Item edited'])(
			'removes the rendered number from edited text %j without consuming content',
			(newText) => {
				const bulletInfo = {
					autoNumType: 'arabicPeriod',
					autoNumStartAt: 1,
					paragraphIndex: 0,
				};
				const original: TextSegment[] = [{ text: '1. ', style: {}, bulletInfo }, seg('Item')];
				const result = remapTextToSegments(newText, original, {});

				expect(result.map((segment) => segment.text)).toStrictEqual(['1. ', 'Item edited']);
				expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
			},
		);

		it('removes a rendered character bullet without consuming content', () => {
			const bulletInfo = { char: '•' };
			const original: TextSegment[] = [{ text: '• ', style: {}, bulletInfo }, seg('Item')];
			const result = remapTextToSegments('•Item edited', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['• ', 'Item edited']);
			expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
		});

		it.each(['1. Item edited', '1.  Item edited'])(
			'preserves an authored leading space in edited text %j',
			(newText) => {
				const bulletInfo = { autoNumType: 'arabicPeriod', paragraphIndex: 0 };
				const original: TextSegment[] = [{ text: '1. ', style: {}, bulletInfo }, seg(' Item')];
				const result = remapTextToSegments(newText, original, {});

				expect(result.map((segment) => segment.text)).toStrictEqual(['1. ', ' Item edited']);
			},
		);

		it('keeps paragraph metadata on the marker and content styles on their runs', () => {
			const paragraphProperties = { paragraphSpacingBefore: 8 };
			const endParaRunProperties = { '@_sz': '1800' };
			const original: TextSegment[] = [
				{
					text: '1. ',
					style: { color: '#FF0000' },
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
					paragraphLevel: 2,
					paragraphProperties,
					endParaRunProperties,
				},
				seg('Bold', { bold: true }),
				seg(' plain', { italic: true }),
			];
			const result = remapTextToSegments('1.Bold plus plain', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['1. ', 'Bold', ' plus plain']);
			expect(result[0].paragraphLevel).toBe(2);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[0].endParaRunProperties).toBe(endParaRunProperties);
			expect(result[1].style.bold).toBeTruthy();
			expect(result[2].style.italic).toBeTruthy();
		});

		it('keeps marker-like content when an auto-number has no runtime paragraph index', () => {
			const bulletInfo = { autoNumType: 'arabicPeriod' };
			const original: TextSegment[] = [{ text: '1.', style: {}, bulletInfo }];
			const result = remapTextToSegments('1.Item', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['1.Item']);
			expect(result[0].bulletInfo).toStrictEqual(bulletInfo);
		});

		it('keeps marker-like text typed into a marker-only empty paragraph', () => {
			const bulletInfo = { autoNumType: 'arabicPeriod', paragraphIndex: 0 };
			const original: TextSegment[] = [{ text: '1.', style: {}, bulletInfo }];
			const result = remapTextToSegments('1.Item', original, {});

			expect(result.map((segment) => segment.text)).toStrictEqual(['1.', '1.Item']);
		});

		it('continues a numbered list when a new paragraph is appended', () => {
			const original: TextSegment[] = [
				{
					text: '1. ',
					style: { color: '#4472C4' },
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
				},
				seg('First item', { bold: true }),
			];
			const before = structuredClone(original);

			const result = remapTextToSegments('First item\nSecond item', original, {});
			const appended = result.slice(result.findIndex((segment) => segment.isParagraphBreak) + 1);

			expect(appended.map((segment) => segment.text)).toStrictEqual(['2. ', 'Second item']);
			expect(appended[0].bulletInfo).toStrictEqual({
				autoNumType: 'arabicPeriod',
				paragraphIndex: 1,
			});
			expect(appended[1].style.bold).toBeTruthy();
			expect(original).toStrictEqual(before);
		});

		it('continues multiple appended paragraphs from a custom numbered-list start', () => {
			const original: TextSegment[] = [
				{
					text: 'd)',
					style: {},
					bulletInfo: {
						autoNumType: 'alphaLcParenR',
						autoNumStartAt: 3,
						paragraphIndex: 1,
					},
				},
				seg('Fourth'),
			];

			const result = remapTextToSegments('Fourth\nFifth\nSixth', original, {});
			const markers = result.filter((segment) => segment.bulletInfo?.autoNumType);

			expect(markers.map((segment) => segment.text)).toStrictEqual(['d)', 'e)', 'f)']);
			expect(markers.map((segment) => segment.bulletInfo?.paragraphIndex)).toStrictEqual([1, 2, 3]);
		});

		it('continues numbering when bulletInfo is carried by the content run', () => {
			const original: TextSegment[] = [
				{
					text: 'First',
					style: {},
					bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 0 },
				},
			];

			const result = remapTextToSegments('First\nSecond', original, {});
			const appended = result.at(-1);

			expect(appended?.text).toBe('Second');
			expect(appended?.bulletInfo).toStrictEqual({
				autoNumType: 'romanUcPeriod',
				paragraphIndex: 1,
			});
		});

		it.each([
			['a character bullet', '• ', { char: '•' }],
			[
				'a picture bullet',
				'• ',
				{ imageDataUrl: 'data:image/png;base64,AA==', imageRelId: 'rId7' },
			],
			['an auto-number without a runtime paragraph index', '1.', { autoNumType: 'arabicPeriod' }],
		] as const)('does not invent a numbered sequence for %s', (_name, marker, bulletInfo) => {
			const original: TextSegment[] = [{ text: marker, style: {}, bulletInfo }, seg('First')];

			const result = remapTextToSegments(`First\nSecond`, original, {});
			const appended = result.slice(result.findIndex((segment) => segment.isParagraphBreak) + 1);
			const appendedBullet = appended.find((segment) => segment.bulletInfo)?.bulletInfo;

			expect(appendedBullet).toStrictEqual(bulletInfo);
			expect(appendedBullet?.paragraphIndex).toBeUndefined();
		});

		it('advances an empty appended paragraph before it receives text', () => {
			const original: TextSegment[] = [
				{
					text: '1.',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
				},
				seg('First'),
			];
			const result = remapTextToSegments('First\n', original, {});
			const appended = result.slice(result.findIndex((segment) => segment.isParagraphBreak) + 1);

			expect(appended[0].bulletInfo?.paragraphIndex).toBe(1);
		});
	});

	describe('paragraph metadata preservation', () => {
		it('keeps paragraph properties, level and end-run properties after a text edit', () => {
			const paragraphProperties = {
				paragraphSpacingBefore: 8,
				paragraphSpacingAfter: 12,
				lineSpacing: 1.5,
			};
			const endParaRunProperties = { '@_sz': '1800' };
			const original: TextSegment[] = [
				{
					text: 'Original',
					style: { fontSize: 18 },
					paragraphLevel: 2,
					paragraphProperties,
					endParaRunProperties,
				},
			];

			const result = remapTextToSegments('Edited', original, {});

			expect(result[0].paragraphLevel).toBe(2);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[0].endParaRunProperties).toBe(endParaRunProperties);
		});

		it('keeps each paragraph own metadata on its first remapped segment', () => {
			const firstProperties = { paragraphSpacingAfter: 6 };
			const secondProperties = { paragraphSpacingBefore: 10 };
			const original: TextSegment[] = [
				{
					text: 'First',
					style: { bold: true },
					paragraphProperties: firstProperties,
				},
				breakSeg(),
				{
					text: 'Second',
					style: { italic: true },
					paragraphProperties: secondProperties,
				},
			];

			const result = remapTextToSegments('First edited\nSecond edited', original, {});
			const paragraphs = result.filter((segment) => !segment.isParagraphBreak);

			expect(paragraphs[0].paragraphProperties).toBe(firstProperties);
			expect(paragraphs[1].paragraphProperties).toBe(secondProperties);
		});

		it('keeps metadata only on the first run of a remapped paragraph', () => {
			const paragraphProperties = { paragraphSpacingBefore: 5 };
			const original: TextSegment[] = [
				{
					text: 'Bold',
					style: { bold: true },
					paragraphProperties,
				},
				seg(' plain', { italic: true }),
			];

			const result = remapTextToSegments('Bold edited plain', original, {});

			expect(result).toHaveLength(2);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[1].paragraphProperties).toBeUndefined();
		});

		it('keeps paragraph metadata when all paragraph text is deleted', () => {
			const paragraphProperties = { paragraphSpacingBefore: 4 };
			const original: TextSegment[] = [
				{
					text: 'Delete me',
					style: {},
					paragraphLevel: 1,
					paragraphProperties,
				},
			];

			const result = remapTextToSegments('', original, {});

			expect(result[0].text).toBe('');
			expect(result[0].paragraphLevel).toBe(1);
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
		});

		it('does not impose paragraph metadata policy on a newly appended paragraph', () => {
			const paragraphProperties = { paragraphSpacingAfter: 9 };
			const original: TextSegment[] = [
				{
					text: 'Existing',
					style: { bold: true },
					paragraphLevel: 2,
					paragraphProperties,
				},
			];

			const result = remapTextToSegments('Existing\nNew', original, {});
			const paragraphs = result.filter((segment) => !segment.isParagraphBreak);

			expect(paragraphs[0].paragraphProperties).toBe(paragraphProperties);
			expect(paragraphs[1].style.bold).toBeTruthy();
			expect(paragraphs[1].paragraphLevel).toBeUndefined();
			expect(paragraphs[1].paragraphProperties).toBeUndefined();
		});

		it('continues a marker and list level without copying unrelated paragraph metadata', () => {
			const paragraphProperties = { paragraphSpacingAfter: 9 };
			const original: TextSegment[] = [
				{
					text: '1.',
					style: {},
					bulletInfo: { autoNumType: 'arabicPeriod', paragraphIndex: 0 },
					paragraphLevel: 2,
					paragraphProperties,
					endParaRunProperties: { '@_sz': '1800' },
				},
				seg('Item'),
			];

			const result = remapTextToSegments('1.Item\n1.New', original, {});
			const lastBreakIndex = result.reduce(
				(index, segment, current) => (segment.isParagraphBreak ? current : index),
				-1,
			);
			const appended = result[lastBreakIndex + 1];

			expect(appended?.bulletInfo).toStrictEqual({
				autoNumType: 'arabicPeriod',
				paragraphIndex: 1,
			});
			expect(appended?.text).toBe('2.');
			expect(appended?.paragraphLevel).toBe(2);
			expect(appended?.paragraphProperties).toBeUndefined();
			expect(appended?.endParaRunProperties).toBeUndefined();
		});

		it('keeps metadata carried by an empty non-final paragraph terminator', () => {
			const paragraphProperties = { paragraphSpacingAfter: 7 };
			const endParaRunProperties = { '@_sz': '1400' };
			const original: TextSegment[] = [
				{
					text: '\n',
					style: { fontSize: 14 },
					isParagraphBreak: true,
					paragraphProperties,
					endParaRunProperties,
				},
				seg('After'),
			];

			const result = remapTextToSegments('\nAfter edit', original, {});

			expect(result[0].text).toBe('');
			expect(result[0].paragraphProperties).toBe(paragraphProperties);
			expect(result[0].endParaRunProperties).toBe(endParaRunProperties);
		});
	});

	describe('segment metadata preservation', () => {
		it('preserves equationXml on an untouched commit (click in, click away)', () => {
			const omml = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };
			const original: TextSegment[] = [
				{ text: '[Equation]', style: { fontFamily: 'Cambria Math' }, equationXml: omml },
			];
			const result = remapTextToSegments('[Equation]', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].equationXml).toBe(omml);
			expect(result[0].text).toBe('[Equation]');
		});

		it('preserves equationXml and equationNumber when the text was edited', () => {
			const omml = { 'm:oMathPara': {} };
			const original: TextSegment[] = [
				{ text: '[Equation]', style: {}, equationXml: omml, equationNumber: '(1)' },
			];
			const result = remapTextToSegments('renamed', original, {});
			expect(result[0].equationXml).toBe(omml);
			expect(result[0].equationNumber).toBe('(1)');
		});

		it('preserves field metadata (fieldType, fieldGuid, fieldGuidAttr)', () => {
			const original: TextSegment[] = [
				{
					text: '4',
					style: {},
					fieldType: 'slidenum',
					fieldGuid: '{ABC}',
					fieldGuidAttr: 'id',
				},
			];
			const result = remapTextToSegments('5', original, {});
			expect(result[0].fieldType).toBe('slidenum');
			expect(result[0].fieldGuid).toBe('{ABC}');
			expect(result[0].fieldGuidAttr).toBe('id');
		});

		it('preserves metadata through the empty-original-text remap path', () => {
			const omml = { 'm:oMath': {} };
			const original: TextSegment[] = [{ text: '', style: { bold: true }, equationXml: omml }];
			const result = remapTextToSegments('typed', original, {});
			expect(result).toHaveLength(1);
			expect(result[0].equationXml).toBe(omml);
		});

		it('does not invent metadata on plain segments', () => {
			const original: TextSegment[] = [seg('plain', { bold: true })];
			const result = remapTextToSegments('plain', original, {});
			expect(result[0].equationXml).toBeUndefined();
			expect(result[0].fieldType).toBeUndefined();
		});
	});

	// Issue: audit item 11. A field run (`a:fld`) displays computed text
	// (`substituteFieldText` in `text-field-substitution.ts` REPLACES a
	// fieldType-tagged segment's stored text wholesale at render, regardless of
	// what is actually stored). The inline editor renders a field's live value
	// as ordinary editable text with no atomic/read-only boundary, so a user who
	// types real content directly after a field (a very common edit: "Page "
	// + <slidenum field> + " of 10") extends the LAST segment of the paragraph,
	// which is the field segment here. `copySegmentMetadata` then carries
	// `fieldType` onto that merged text, and the next render calls
	// `substituteFieldText` on the WHOLE merged string, discarding everything
	// the user typed beyond the field's own original text - silently, with no
	// error and no visual difference until the deck is re-rendered.
	describe('field-run (a:fld) boundary', () => {
		it('does not let literal text typed after a field merge into the field segment', () => {
			// "Page " (literal) + "3" (fieldType: slidenum, the paragraph's LAST
			// segment) -> user appends " of 10" right after the field.
			const original: TextSegment[] = [
				seg('Page '),
				{ text: '3', style: {}, fieldType: 'slidenum' },
			];
			const result = remapTextToSegments('Page 3 of 10', original, {});

			// The field segment's own text must stay bounded to what it originally
			// held; anything typed beyond it belongs to a new, non-field segment.
			const fieldSeg = result.find((s) => s.fieldType === 'slidenum');
			expect(fieldSeg?.text).toBe('3');

			// The literal " of 10" the user typed must survive as its own segment
			// carrying NO fieldType, or it is silently discarded by field
			// substitution on every subsequent render.
			const literalTail = result.find((s) => s.fieldType === undefined && s.text.includes('of 10'));
			expect(literalTail?.text).toBe(' of 10');

			// Concatenating every segment's stored text must reproduce exactly what
			// was typed - nothing invented, nothing dropped.
			expect(result.map((s) => s.text).join('')).toBe('Page 3 of 10');
		});

		it('still lets a field run be renamed/shortened when the edit stays within it', () => {
			const original: TextSegment[] = [
				seg('Page '),
				{ text: '3', style: {}, fieldType: 'slidenum' },
			];
			const result = remapTextToSegments('Page ', original, {});
			expect(result.map((s) => s.text).join('')).toBe('Page ');
		});
	});
});
