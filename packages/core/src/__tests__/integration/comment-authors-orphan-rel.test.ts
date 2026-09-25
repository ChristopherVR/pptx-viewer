import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

const COMMENT_AUTHORS_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/commentAuthors';

/**
 * Build a minimal PPTX that contains a `ppt/commentAuthors.xml` part AND a
 * matching Relationship entry in `ppt/_rels/presentation.xml.rels`, but with
 * no slide comments referencing any author. This mirrors the real-world case
 * of a source file whose comments have all been removed but whose authors
 * list was preserved on the original save.
 */
async function buildPptxWithOrphanableCommentAuthors(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addText('No comments here', { x: 50, y: 50, width: 400, height: 50 })
			.build(),
	);
	const bytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(bytes);
	zip.file(
		'ppt/commentAuthors.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:cmAuthorLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cmAuthor id="1" name="Alice" initials="A" lastIdx="0" clrIdx="0"/></p:cmAuthorLst>`,
	);

	const relsPath = 'ppt/_rels/presentation.xml.rels';
	const relsXml = await zip.file(relsPath)!.async('string');
	const rIdMatch = relsXml.match(/rId(\d+)/g) ?? [];
	const maxRid = rIdMatch.reduce((acc, r) => Math.max(acc, Number(r.slice(3))), 0);
	const newRid = `rId${maxRid + 1}`;
	const injected = relsXml.replace(
		'</Relationships>',
		`<Relationship Id="${newRid}" Type="${COMMENT_AUTHORS_REL_TYPE}" Target="commentAuthors.xml"/></Relationships>`,
	);
	zip.file(relsPath, injected);

	const ctXml = await zip.file('[Content_Types].xml')!.async('string');
	if (!ctXml.includes('/ppt/commentAuthors.xml')) {
		const override = `<Override PartName="/ppt/commentAuthors.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml"/>`;
		zip.file('[Content_Types].xml', ctXml.replace('</Types>', `${override}</Types>`));
	}

	return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * The part, its presentation relationship and its content-type override must
 * always travel together: a relationship left behind by a removed part makes
 * PowerPoint prompt for repair.
 */
async function authorPackageState(bytes: Uint8Array | ArrayBuffer): Promise<{
	part: string | undefined;
	rel: boolean;
	override: boolean;
}> {
	const zip = await JSZip.loadAsync(bytes);
	const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
	const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	return {
		part: await zip.file('ppt/commentAuthors.xml')?.async('string'),
		rel: rels.includes(COMMENT_AUTHORS_REL_TYPE) && rels.includes('commentAuthors.xml'),
		override: contentTypes.includes('/ppt/commentAuthors.xml'),
	};
}

describe('commentAuthors part, relationship and override stay consistent', () => {
	it('keeps an author list the source shipped without comments, with its rel and override', async () => {
		const inputBytes = await buildPptxWithOrphanableCommentAuthors();
		const before = await authorPackageState(inputBytes);
		expect(before.part).toContain('name="Alice"');
		expect(before.rel).toBeTruthy();
		expect(before.override).toBeTruthy();

		const handler = new PptxHandler();
		const data = await handler.load(inputBytes);
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const after = await authorPackageState(await handler.save(data.slides));

		// Nothing this session deleted the authors: all three survive untouched.
		expect(after).toStrictEqual(before);
	});

	it('keeps an empty <p:cmAuthorLst/> the source shipped', async () => {
		const inputBytes = await buildPptxWithOrphanableCommentAuthors();
		const zip = await JSZip.loadAsync(inputBytes);
		const emptyList = `<?xml version="1.0" encoding="UTF-8"?>\n<p:cmAuthorLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
		zip.file('ppt/commentAuthors.xml', emptyList);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
		data.slides[0]!.isDirty = true;
		const after = await authorPackageState(await handler.save(data.slides));

		expect(after).toStrictEqual({ part: emptyList, rel: true, override: true });
	});

	it('removes all three once the last comment is deleted this session', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		slide.comments = [{ id: '0', author: 'Alice', text: 'Remove me' }];
		data.slides.push(slide);
		const withComment = await handler.save(data.slides);

		const reloaded = new PptxHandler();
		const loaded = await reloaded.load(
			withComment.buffer.slice(
				withComment.byteOffset,
				withComment.byteOffset + withComment.byteLength,
			) as ArrayBuffer,
		);
		loaded.slides[0]!.comments = [];
		loaded.slides[0]!.isDirty = true;
		const after = await authorPackageState(await reloaded.save(loaded.slides));

		expect(after).toStrictEqual({ part: undefined, rel: false, override: false });
	});
});
