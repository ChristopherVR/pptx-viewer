import { describe, expect, it } from 'vitest';

import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	formatBackstageDate,
	formatBackstageSize,
	createBackstagePresentation,
} from './backstage';

describe('backstage model', () => {
	it('contains the complete PowerPoint-style navigation', () => {
		expect(BACKSTAGE_NAV.map((item) => item.id)).toStrictEqual([
			'home',
			'new',
			'open',
			'info',
			'save',
			'saveAs',
			'print',
			'share',
			'export',
			'close',
			'account',
			'options',
		]);
	});

	it('ships a useful starter template gallery', () => {
		expect(BACKSTAGE_TEMPLATES.length).toBeGreaterThanOrEqual(6);
		expect(BACKSTAGE_TEMPLATES[0]?.id).toBe('blank');
	});

	it('creates a fresh themed presentation', () => {
		const [slide] = createBackstagePresentation('warm');
		expect(slide?.elements).toStrictEqual([]);
		expect(slide?.backgroundColor).toBe('#d94b20');
	});

	it('formats recent-file metadata', () => {
		expect(formatBackstageDate(900_000, 1_000_000)).toBe('1 min ago');
		expect(formatBackstageSize(2_621_440)).toBe('2.5 MB');
	});
});
