import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { PptxComment, PptxCommentMention, XmlObject } from '../types';
import {
	buildModernCommentPart,
	parseModernCommentPart,
	readCommentMentions,
	rebaseCommentMentions,
} from './modern-comment-xml';

/**
 * The body below is the REAL `p188` markup PowerPoint 16.0 (build 20228) wrote
 * for `Slide.Comments.Add2(...)`, taken verbatim from
 * `ppt/comments/modernComment_100_3CF72354.xml`, with a `p188:mentionLst`
 * hand-authored into it using the `CT_Mention` attribute vocabulary
 * (`mentionpersonId` / `mentionId` / `startIndex` / `length`).
 */
const ALICE = '{12219ED4-AB40-1676-B632-B1C0CC6115FF}';

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';

const REAL_PART = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p188:cmLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p188="http://schemas.microsoft.com/office/powerpoint/2018/8/main"><p188:cm id="{468AD027-6FFB-4303-AE52-65C36477CD82}" authorId="${ALICE}" created="2026-08-13T07:32:12.520"><pc:sldMkLst xmlns:pc="http://schemas.microsoft.com/office/powerpoint/2013/main/command"><pc:docMk/><pc:sldMk cId="1022829396" sldId="256"/></pc:sldMkLst><p188:pos x="1270000" y="1270000"/><p188:replyLst><p188:reply id="{531A95DB-20A3-4B1E-8F52-A9B5136A637E}" authorId="${BOB}" created="2026-08-13T07:32:12.566"><p188:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Sure, looking now</a:t></a:r></a:p></p188:txBody></p188:reply></p188:replyLst><p188:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Hi Bob Example can you check this</a:t></a:r></a:p></p188:txBody><p188:mentionLst><p188:mention mentionpersonId="${BOB}" mentionId="{9F1F2B44-8C2A-4E31-9E10-0B7E4A6D51C3}" startIndex="3" length="11"/></p188:mentionLst></p188:cm></p188:cmLst>`;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	trimValues: false,
});

const AUTHOR_NAMES: Record<string, string> = { [ALICE]: 'Alice Example', [BOB]: 'Bob Example' };

function authorName(id: string): string | undefined {
	return AUTHOR_NAMES[id];
}

function parseFixture(): PptxComment {
	return parseModernCommentPart(
		parser.parse(REAL_PART) as XmlObject,
		{ path: 'ppt/comments/modernComment_100_3CF72354.xml', relationshipId: 'rId2' },
		authorName,
		9525,
	).comments[0];
}

function mentionsOf(node: XmlObject): XmlObject[] {
	const list = node['p188:mentionLst'] as XmlObject | undefined;
	const entries = list?.['p188:mention'];
	return Array.isArray(entries) ? (entries as XmlObject[]) : entries ? [entries as XmlObject] : [];
}

function rebuild(comment: PptxComment): XmlObject {
	const part = buildModernCommentPart([comment], undefined, () => ALICE, 9525);
	const root = part['p188:cmLst'] as XmlObject;
	const list = root['p188:cm'];
	return (Array.isArray(list) ? list[0] : list) as XmlObject;
}

function commentNode(xml: string): XmlObject {
	return (parser.parse(xml) as XmlObject)['p188:cm'] as XmlObject;
}

describe('modern comment mentions', () => {
	it('parses a p188:mentionLst off real PowerPoint-authored markup', () => {
		const comment = parseFixture();
		expect(comment.text).toBe('Hi Bob Example can you check this');
		expect(comment.mentions).toStrictEqual([
			{
				personId: BOB,
				id: '{9F1F2B44-8C2A-4E31-9E10-0B7E4A6D51C3}',
				authorName: 'Bob Example',
				startIndex: 3,
				length: 11,
				containerUri: undefined,
				rawXml: expect.anything(),
			},
		]);
		// The offsets index the flattened plain text.
		const mention = comment.mentions![0];
		expect(comment.text.slice(mention.startIndex, mention.startIndex + mention.length)).toBe(
			'Bob Example',
		);
	});

	it('reads a mention list nested in p188:extLst and remembers the uri', () => {
		const node = commentNode(
			`<p188:cm><p188:extLst><p188:ext uri="{ABC}"><p188:mentionLst><p188:mention mentionpersonId="${BOB}" mentionId="{M}" startIndex="0" length="3"/></p188:mentionLst></p188:ext></p188:extLst></p188:cm>`,
		);
		const mentions = readCommentMentions(node, authorName);
		expect(mentions).toHaveLength(1);
		expect(mentions![0].containerUri).toBe('{ABC}');
	});

	it('re-emits the mention list unchanged when the text did not change', () => {
		expect(mentionsOf(rebuild(parseFixture()))).toStrictEqual([
			{
				'@_mentionpersonId': BOB,
				'@_mentionId': '{9F1F2B44-8C2A-4E31-9E10-0B7E4A6D51C3}',
				'@_startIndex': '3',
				'@_length': '11',
			},
		]);
	});

	it('re-bases startIndex when an edit inserts text before the mention', () => {
		// "Hi Bob Example ..." -> "Hi there Bob Example ..."
		const edited: PptxComment = {
			...parseFixture(),
			text: 'Hi there Bob Example can you check this',
		};
		const emitted = mentionsOf(rebuild(edited));
		expect(emitted).toHaveLength(1);
		expect(emitted[0]['@_startIndex']).toBe('9');
		expect(edited.text.slice(9, 9 + 11)).toBe('Bob Example');
	});

	it('re-bases when the edit is length-preserving but moves the mention', () => {
		const comment = parseFixture();
		// Same length either side, but the span slid one character left.
		const edited: PptxComment = { ...comment, text: 'H Bob Example can you check thisX' };
		expect(edited.text).toHaveLength(comment.text.length);
		expect(mentionsOf(rebuild(edited))[0]['@_startIndex']).toBe('2');
	});

	it('drops a mention whose span was deleted', () => {
		const edited: PptxComment = { ...parseFixture(), text: 'Hi can you check this' };
		expect(mentionsOf(rebuild(edited))).toHaveLength(0);
		expect(rebuild(edited)['p188:mentionLst']).toBeUndefined();
	});

	it('drops a mention whose span was only partly deleted', () => {
		const edited: PptxComment = { ...parseFixture(), text: 'Hi Bob can you check this' };
		expect(mentionsOf(rebuild(edited))).toHaveLength(0);
	});

	it('re-bases mentions inside an extLst container in place', () => {
		const source = commentNode(
			`<p188:cm id="{C}" authorId="${ALICE}" created="2026-01-01T00:00:00"><p188:txBody><a:p><a:r><a:t>Hi Bob Example</a:t></a:r></a:p></p188:txBody><p188:extLst><p188:ext uri="{ABC}"><p188:mentionLst><p188:mention mentionpersonId="${BOB}" mentionId="{M}" startIndex="3" length="11"/></p188:mentionLst></p188:ext></p188:extLst></p188:cm>`,
		);
		const built = rebuild({
			id: '{C}',
			format: 'modern',
			text: 'Hey there Bob Example',
			mentions: readCommentMentions(source, authorName),
			rawXml: source,
		});
		expect(built['p188:mentionLst']).toBeUndefined();
		const extension = built['p188:extLst'] as XmlObject;
		expect(mentionsOf(extension['p188:ext'] as XmlObject)[0]['@_startIndex']).toBe('10');
	});

	it('preserves unknown mention attributes through a round-trip', () => {
		const source = commentNode(
			`<p188:cm><p188:mentionLst><p188:mention mentionpersonId="${BOB}" mentionId="{M}" startIndex="0" length="3" someFutureFlag="1"/></p188:mentionLst></p188:cm>`,
		);
		const mentions = readCommentMentions(source, authorName)!;
		const built = rebuild({ id: 'x', format: 'modern', text: 'Bob', mentions });
		expect(mentionsOf(built)[0]['@_someFutureFlag']).toBe('1');
	});

	it('accepts the mentionCharCount spelling of length', () => {
		const source = commentNode(
			`<p188:cm><p188:mentionLst><p188:mention mentionpersonId="${BOB}" mentionId="{M}" startIndex="0" mentionCharCount="3"/></p188:mentionLst></p188:cm>`,
		);
		const mentions = readCommentMentions(source, authorName)!;
		expect(mentions[0]).toMatchObject({ length: 3 });
		expect(
			mentionsOf(rebuild({ id: 'x', format: 'modern', text: 'Bob', mentions }))[0],
		).toStrictEqual({
			'@_mentionpersonId': BOB,
			'@_mentionId': '{M}',
			'@_startIndex': '0',
			'@_mentionCharCount': '3',
		});
	});
});

describe('rebaseCommentMentions', () => {
	function mention(startIndex: number, length: number): PptxCommentMention {
		return { personId: BOB, startIndex, length };
	}

	it('leaves a mention before the edit alone', () => {
		expect(
			rebaseCommentMentions([mention(0, 3)], 'Bob and Ann', 'Bob and Anna')![0].startIndex,
		).toBe(0);
	});

	it('shifts a mention after a deletion', () => {
		expect(rebaseCommentMentions([mention(8, 3)], 'Hi hi.. Bob', 'Hi Bob')![0].startIndex).toBe(3);
	});

	it('returns undefined when every mention was destroyed', () => {
		expect(rebaseCommentMentions([mention(0, 3)], 'Bob', 'Ann')).toBeUndefined();
	});

	it('drops a mention whose recorded span ran past the old text', () => {
		expect(rebaseCommentMentions([mention(0, 99)], 'Bob', 'Bob!')).toBeUndefined();
	});
});
