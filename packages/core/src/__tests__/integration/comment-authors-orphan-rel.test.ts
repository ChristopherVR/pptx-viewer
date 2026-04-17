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

describe('commentAuthors orphan relationship cleanup', () => {
	it('removes both commentAuthors.xml and its presentation.xml.rels Relationship when no comments are active', async () => {
		const inputBytes = await buildPptxWithOrphanableCommentAuthors();

		const inputZip = await JSZip.loadAsync(inputBytes);
		expect(inputZip.file('ppt/commentAuthors.xml')).not.toBeNull();
		await expect(
			inputZip.file('ppt/_rels/presentation.xml.rels')!.async('string'),
		).resolves.toContain(COMMENT_AUTHORS_REL_TYPE);

		const handler = new PptxHandler();
		const data = await handler.load(inputBytes);
		const savedBytes = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(savedBytes);

		expect(savedZip.file('ppt/commentAuthors.xml')).toBeNull();

		const savedRels = await savedZip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		expect(savedRels).not.toContain(COMMENT_AUTHORS_REL_TYPE);
		expect(savedRels).not.toContain('commentAuthors.xml');
	});
});
