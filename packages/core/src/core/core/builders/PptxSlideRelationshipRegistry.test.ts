/**
 * Tests for {@link isExternalTarget} and the relationship registry's
 * `TargetMode="External"` decision.
 *
 * Covers PK-H4 — the legacy regex only recognised `https?:|mailto:|ftp:|file:`,
 * which silently dropped `TargetMode="External"` for `tel:`, `ms-teams:`,
 * `skype:`, and any other non-allowlisted scheme. The new policy uses
 * RFC 3986 §3.1 generic scheme detection.
 */

import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxSlideRelationshipRegistry, isExternalTarget } from './PptxSlideRelationshipRegistry';

describe('isExternalTarget', () => {
	it('treats common URL schemes as external', () => {
		expect(isExternalTarget('https://example.com')).toBeTruthy();
		expect(isExternalTarget('http://example.com')).toBeTruthy();
		expect(isExternalTarget('mailto:hi@example.com')).toBeTruthy();
		expect(isExternalTarget('ftp://server/file')).toBeTruthy();
		expect(isExternalTarget('file:///c:/x.txt')).toBeTruthy();
	});

	it('treats office/messaging schemes as external (PK-H4)', () => {
		expect(isExternalTarget('tel:+1-800-555')).toBeTruthy();
		expect(isExternalTarget('ms-teams://l/chat/0')).toBeTruthy();
		expect(isExternalTarget('skype:user?call')).toBeTruthy();
		expect(isExternalTarget('callto:user')).toBeTruthy();
		expect(isExternalTarget('webcal://example.com/cal.ics')).toBeTruthy();
	});

	it('treats relative package paths as internal', () => {
		expect(isExternalTarget('slides/slide1.xml')).toBeFalsy();
		expect(isExternalTarget('../theme/theme1.xml')).toBeFalsy();
		expect(isExternalTarget('./image.png')).toBeFalsy();
		expect(isExternalTarget('/ppt/slides/slide1.xml')).toBeFalsy();
	});

	it('rejects schemes that contain a slash before the colon', () => {
		// `path/to/file:something` is not a URL scheme — it's a relative path.
		expect(isExternalTarget('path/to/file:something')).toBeFalsy();
	});

	it('rejects empty / whitespace-only targets', () => {
		expect(isExternalTarget('')).toBeFalsy();
		expect(isExternalTarget('   ')).toBeFalsy();
	});
});

describe('pptxSlideRelationshipRegistry', () => {
	it('marks tel: and ms-teams: hyperlinks as External', () => {
		const relationships: XmlObject[] = [];
		const registry = new PptxSlideRelationshipRegistry({ relationships });

		registry.resolveHyperlinkRelationshipId('tel:+1-800-555');
		registry.resolveHyperlinkRelationshipId('ms-teams://l/chat/abc');

		expect(relationships).toHaveLength(2);
		expect(relationships[0]['@_TargetMode']).toBe('External');
		expect(relationships[1]['@_TargetMode']).toBe('External');
	});

	it('does not mark relative targets as External', () => {
		const relationships: XmlObject[] = [];
		const registry = new PptxSlideRelationshipRegistry({ relationships });
		registry.resolveHyperlinkRelationshipId('../slides/slide2.xml');
		expect(relationships[0]['@_TargetMode']).toBeUndefined();
	});
});
