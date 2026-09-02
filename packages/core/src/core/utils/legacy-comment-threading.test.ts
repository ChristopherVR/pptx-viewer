import { describe, expect, it } from 'vitest';

import type { PptxComment, XmlObject } from '../types';
import {
	buildLegacyThreadingExtLst,
	flattenLegacyCommentThread,
	LEGACY_THREADING_EXT_URI,
	legacyCommentExtLst,
	nestLegacyCommentReplies,
	parseLegacyThreadingParent,
} from './legacy-comment-threading';

const threadingExtLst = (authorId: string, idx: string, timeZoneBias?: string): XmlObject => ({
	'p:ext': {
		'@_uri': LEGACY_THREADING_EXT_URI,
		'p15:threadingInfo': {
			'@_xmlns:p15': 'http://schemas.microsoft.com/office/powerpoint/2012/main',
			...(timeZoneBias !== undefined ? { '@_timeZoneBias': timeZoneBias } : {}),
			'p15:parentCm': { '@_authorId': authorId, '@_idx': idx },
		},
	},
});

describe('parseLegacyThreadingParent', () => {
	it('reads @authorId/@idx off a hand-written p:cmLst fixture', () => {
		const commentNode: XmlObject = {
			'@_authorId': '1',
			'@_idx': '1',
			'p:text': 'Done.',
			'p:extLst': threadingExtLst('0', '0', '-480'),
		};
		expect(parseLegacyThreadingParent(commentNode)).toStrictEqual({
			authorId: '0',
			idx: '0',
			timeZoneBias: '-480',
		});
	});

	it('returns undefined when there is no extLst', () => {
		expect(parseLegacyThreadingParent({ '@_authorId': '0', '@_idx': '0' })).toBeUndefined();
	});

	it('returns undefined when extLst has no threading extension', () => {
		const commentNode: XmlObject = {
			'p:extLst': { 'p:ext': { '@_uri': '{other}', 'x:data': {} } },
		};
		expect(parseLegacyThreadingParent(commentNode)).toBeUndefined();
	});

	it('ignores a threading extension missing authorId or idx', () => {
		const commentNode: XmlObject = {
			'p:extLst': {
				'p:ext': {
					'@_uri': LEGACY_THREADING_EXT_URI,
					'p15:threadingInfo': { 'p15:parentCm': { '@_authorId': '0' } },
				},
			},
		};
		expect(parseLegacyThreadingParent(commentNode)).toBeUndefined();
	});

	it('finds the threading extension among several p:ext entries', () => {
		const commentNode: XmlObject = {
			'p:extLst': {
				'p:ext': [{ '@_uri': '{other}', 'x:data': {} }, threadingExtLst('2', '3')['p:ext']],
			},
		};
		expect(parseLegacyThreadingParent(commentNode)).toStrictEqual({ authorId: '2', idx: '3' });
	});
});

describe('legacyCommentExtLst', () => {
	it('finds p:extLst by local name', () => {
		const node: XmlObject = { 'p:extLst': { 'p:ext': [] } };
		expect(legacyCommentExtLst(node)).toBe(node['p:extLst']);
	});

	it('returns undefined when absent', () => {
		expect(legacyCommentExtLst({})).toBeUndefined();
		expect(legacyCommentExtLst(undefined)).toBeUndefined();
	});
});

const comment = (overrides: Partial<PptxComment>): PptxComment => ({
	id: overrides.id ?? '0',
	text: overrides.text ?? 'text',
	...overrides,
});

describe('nestLegacyCommentReplies', () => {
	it('nests a reply under its parent and sets parentId/threadId', () => {
		const root = comment({
			id: 'c0',
			text: 'Please update this chart.',
			rawXml: { '@_authorId': '0', '@_idx': '0' },
		});
		const reply = comment({
			id: 'c1',
			text: 'Done.',
			rawXml: { '@_authorId': '1', '@_idx': '0', 'p:extLst': threadingExtLst('0', '0') },
		});
		const nested = nestLegacyCommentReplies([root, reply]);
		expect(nested).toHaveLength(1);
		expect(nested[0].id).toBe('c0');
		expect(nested[0].replies).toHaveLength(1);
		expect(nested[0].replies?.[0].id).toBe('c1');
		expect(nested[0].replies?.[0].parentId).toBe('c0');
		expect(nested[0].replies?.[0].threadId).toBe('c0');
		expect(nested[0].threadId).toBe('c0');
	});

	it('nests a multi-level thread (reply to a reply)', () => {
		const root = comment({ id: 'c0', rawXml: { '@_authorId': '0', '@_idx': '0' } });
		const reply1 = comment({
			id: 'c1',
			rawXml: { '@_authorId': '1', '@_idx': '0', 'p:extLst': threadingExtLst('0', '0') },
		});
		const reply2 = comment({
			id: 'c2',
			rawXml: { '@_authorId': '0', '@_idx': '1', 'p:extLst': threadingExtLst('1', '0') },
		});
		const nested = nestLegacyCommentReplies([root, reply1, reply2]);
		expect(nested).toHaveLength(1);
		expect(nested[0].replies?.[0].id).toBe('c1');
		expect(nested[0].replies?.[0].replies?.[0].id).toBe('c2');
		expect(nested[0].replies?.[0].replies?.[0].parentId).toBe('c1');
		expect(nested[0].replies?.[0].replies?.[0].threadId).toBe('c0');
	});

	it('leaves comments flat when no threading extension is present', () => {
		const a = comment({ id: 'c0', rawXml: { '@_authorId': '0', '@_idx': '0' } });
		const b = comment({ id: 'c1', rawXml: { '@_authorId': '1', '@_idx': '0' } });
		expect(nestLegacyCommentReplies([a, b])).toStrictEqual([a, b]);
	});

	it('leaves a comment flat when its threading reference is dangling', () => {
		const a = comment({
			id: 'c0',
			rawXml: { '@_authorId': '0', '@_idx': '0', 'p:extLst': threadingExtLst('9', '9') },
		});
		const nested = nestLegacyCommentReplies([a]);
		expect(nested).toStrictEqual([a]);
		expect(a.parentId).toBeUndefined();
	});

	it('ignores a self-referencing threading extension', () => {
		const a = comment({
			id: 'c0',
			rawXml: { '@_authorId': '0', '@_idx': '0', 'p:extLst': threadingExtLst('0', '0') },
		});
		const nested = nestLegacyCommentReplies([a]);
		expect(nested).toStrictEqual([a]);
		expect(a.parentId).toBeUndefined();
	});
});

describe('flattenLegacyCommentThread', () => {
	it('is the inverse of nestLegacyCommentReplies (depth-first)', () => {
		const root = comment({ id: 'c0' });
		const child = comment({ id: 'c1', parentId: 'c0' });
		const grandchild = comment({ id: 'c2', parentId: 'c1' });
		root.replies = [{ ...child, replies: [grandchild] }];
		expect(flattenLegacyCommentThread([root]).map((c) => c.id)).toStrictEqual(['c0', 'c1', 'c2']);
	});

	it('passes through an already-flat list unchanged', () => {
		const a = comment({ id: 'c0' });
		const b = comment({ id: 'c1' });
		expect(flattenLegacyCommentThread([a, b])).toStrictEqual([a, b]);
	});
});

describe('buildLegacyThreadingExtLst', () => {
	it('builds a fresh extension when the comment had none', () => {
		const result = buildLegacyThreadingExtLst(undefined, { authorId: '0', idx: '0' });
		expect(result).toStrictEqual({
			'p:ext': {
				'@_uri': LEGACY_THREADING_EXT_URI,
				'p15:threadingInfo': {
					'@_xmlns:p15': 'http://schemas.microsoft.com/office/powerpoint/2012/main',
					'@_timeZoneBias': '0',
					'p15:parentCm': { '@_authorId': '0', '@_idx': '0' },
				},
			},
		});
	});

	it('preserves a supplied timeZoneBias instead of defaulting', () => {
		const result = buildLegacyThreadingExtLst(undefined, {
			authorId: '0',
			idx: '0',
			timeZoneBias: '-480',
		});
		const ext = result?.['p:ext'] as XmlObject;
		const threadingInfo = ext['p15:threadingInfo'] as XmlObject;
		expect(threadingInfo['@_timeZoneBias']).toBe('-480');
	});

	it('removes the threading extension when parent is undefined, keeping others', () => {
		const existing: XmlObject = {
			'p:ext': [
				{ '@_uri': '{other-uri}', 'x:data': 'opaque' },
				threadingExtLst('0', '0')['p:ext'] as XmlObject,
			],
		};
		const result = buildLegacyThreadingExtLst(existing, undefined);
		expect(result).toStrictEqual({ 'p:ext': { '@_uri': '{other-uri}', 'x:data': 'opaque' } });
	});

	it('returns undefined when there is nothing left to write', () => {
		expect(buildLegacyThreadingExtLst(undefined, undefined)).toBeUndefined();
		expect(buildLegacyThreadingExtLst(threadingExtLst('0', '0'), undefined)).toBeUndefined();
	});

	it('replaces an existing threading extension rather than duplicating it', () => {
		const existing = threadingExtLst('0', '0');
		const result = buildLegacyThreadingExtLst(existing, { authorId: '2', idx: '5' });
		const exts = result?.['p:ext'];
		expect(Array.isArray(exts)).toBeFalsy();
		expect((exts as XmlObject)['p15:threadingInfo']).toMatchObject({
			'p15:parentCm': { '@_authorId': '2', '@_idx': '5' },
		});
	});

	it('keeps an unrelated extension alongside a rebuilt threading extension', () => {
		const existing: XmlObject = {
			'p:ext': [{ '@_uri': '{other-uri}', 'x:data': 'opaque' }],
		};
		const result = buildLegacyThreadingExtLst(existing, { authorId: '0', idx: '0' });
		const exts = result?.['p:ext'] as XmlObject[];
		expect(exts).toHaveLength(2);
		expect(exts.some((ext) => ext['@_uri'] === '{other-uri}')).toBeTruthy();
		expect(exts.some((ext) => ext['@_uri'] === LEGACY_THREADING_EXT_URI)).toBeTruthy();
	});
});
