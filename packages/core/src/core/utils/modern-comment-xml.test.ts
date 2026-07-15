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
