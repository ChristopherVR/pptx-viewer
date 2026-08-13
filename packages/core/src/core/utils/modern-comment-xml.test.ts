import { describe, expect, it } from 'vitest';

import type { PptxComment, XmlObject } from '../types';
import {
	buildModernAuthorPart,
	buildModernCommentPart,
	MODERN_COMMENT_NAMESPACE,
	parseModernAuthors,
	parseModernCommentPart,
} from './modern-comment-xml';

describe('modern PowerPoint comments XML', () => {
	it('parses arbitrary prefixes, replies, task metadata, and positions', () => {
		const data: XmlObject = {
			'x:cmLst': {
				'x:cm': {
					'@_id': 'c1',
					'@_authorId': 'a1',
					'@_status': 'resolved',
					'@_assignedTo': 'a2 a3',
					'x:pos': { '@_x': '9525', '@_y': '19050' },
					'x:txBody': { 'a:p': { 'a:r': { 'a:t': 'Root' } } },
					'x:replyLst': {
						'x:reply': {
							'@_id': 'r1',
							'@_authorId': 'a2',
							'x:txBody': { 'a:p': { 'a:r': { 'a:t': 'Reply' } } },
						},
					},
				},
			},
		};
		const parsed = parseModernCommentPart(
			data,
			{ path: 'ppt/comments/comment1.xml', relationshipId: 'rId5' },
			(id) => ({ a1: 'Ada', a2: 'Bob' })[id],
			9525,
		);
		expect(parsed.comments[0]).toMatchObject({
			id: 'c1',
			text: 'Root',
			author: 'Ada',
			resolved: true,
			x: 1,
			y: 2,
			assignedTo: ['a2', 'a3'],
		});
		expect(parsed.comments[0].replies?.[0]).toMatchObject({ id: 'r1', text: 'Reply' });
	});

	it('serializes edits while preserving unknown root, comment, and extension XML', () => {
		const comment: PptxComment = {
			id: 'c1',
			format: 'modern',
			text: 'Edited',
			authorId: 'a1',
			createdAt: '2026-01-02T03:04:05Z',
			x: 4,
			y: 5,
			rawXml: {
				'@_vendor': 'keep',
				'x:unknownAnchor': {},
				'x:txBody': { 'a:p': { 'a:r': { 'a:t': 'Old' } } },
				'x:extLst': { 'x:ext': { '@_uri': 'keep' } },
			},
		};
		const built = buildModernCommentPart(
			[comment],
			{ '@_vendorRoot': 'keep', 'x:extLst': { 'x:ext': {} } },
			() => 'a1',
			9525,
		);
		const root = built['p188:cmLst'] as XmlObject;
		const node = (root['p188:cm'] as XmlObject[])[0];
		expect(root['@_xmlns:p188']).toBe(MODERN_COMMENT_NAMESPACE);
		expect(root['@_vendorRoot']).toBe('keep');
		expect(node['@_vendor']).toBe('keep');
		expect(node['p188:pos']).toStrictEqual({ '@_x': '38100', '@_y': '47625' });
		expect(node['p188:extLst']).toStrictEqual({ 'x:ext': { '@_uri': 'keep' } });
	});

	it('preserves rich runs and mention metadata when only the text changed', () => {
		const raw: XmlObject = {
			'@_created': '2024-01-02T03:04:05.000Z',
			'p188:mentionLst': {
				'p188:mention': { '@_mentionpersonName': 'Jane Doe', '@_startIdx': '0', '@_length': '9' },
			},
			'p188:txBody': {
				'a:bodyPr': {},
				'a:p': {
					'a:r': [
						{ 'a:rPr': { '@_b': '1' }, 'a:t': '@Jane Doe' },
						{ 'a:rPr': {}, 'a:t': ' please review' },
					],
				},
			},
		};
		const comment: PptxComment = {
			id: 'c1',
			format: 'modern',
			text: '@Jane Doe please review today',
			authorId: 'a1',
			createdAt: '2024-01-02T03:04:05.000Z',
			rawXml: raw,
		};
		const built = buildModernCommentPart([comment], undefined, () => 'a1', 9525);
		const node = ((built['p188:cmLst'] as XmlObject)['p188:cm'] as XmlObject[])[0];
		const runs = ((node['p188:txBody'] as XmlObject)['a:p'] as XmlObject)['a:r'] as XmlObject[];

		expect(runs).toHaveLength(2);
		expect(runs[0]).toStrictEqual({ 'a:rPr': { '@_b': '1' }, 'a:t': '@Jane Doe' });
		expect(runs[1]['a:t']).toBe(' please review today');
		expect(node['p188:mentionLst']).toStrictEqual(raw['p188:mentionLst']);
	});

	it('persists un-resolving a thread and keeps an unparsable created stamp', () => {
		const comment: PptxComment = {
			id: 'c1',
			format: 'modern',
			text: 'Root',
			authorId: 'a1',
			// The shared comment-list toggle flips `resolved` only; `status` is
			// the stale value carried over from the source part.
			status: 'resolved',
			resolved: false,
			createdAt: 'not a date',
			rawXml: { '@_created': '0001-01-01T00:00:00' },
		};
		const built = buildModernCommentPart([comment], undefined, () => 'a1', 9525);
		const node = ((built['p188:cmLst'] as XmlObject)['p188:cm'] as XmlObject[])[0];

		expect(node['@_status']).toBe('active');
		expect(node['@_created']).toBe('0001-01-01T00:00:00');
	});

	it('round-trips modern author identity and unknown XML', () => {
		const source: XmlObject = {
			'x:authorLst': {
				'@_vendor': 'keep',
				'x:author': {
					'@_id': 'a1',
					'@_name': 'Ada',
					'@_initials': 'AL',
					'@_userId': 'u1',
					'@_providerId': 'p1',
					'x:extLst': { 'x:ext': {} },
				},
			},
		};
		const parsed = parseModernAuthors(source);
		parsed.authors[0].name = 'Ada Lovelace';
		const built = buildModernAuthorPart(parsed.authors, parsed.root);
		const root = built['p188:authorLst'] as XmlObject;
		const author = (root['p188:author'] as XmlObject[])[0];
		expect(root['@_vendor']).toBe('keep');
		expect(author['@_name']).toBe('Ada Lovelace');
		expect(author['x:extLst']).toStrictEqual({ 'x:ext': {} });
	});
});
