import { describe, expect, it, vi } from 'vitest';

import { generatePackageReadme } from './package-readme';

describe('generatePackageReadme', () => {
	it('describes the packaged presentation and media folder', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-16T00:00:00Z'));

		const readme = generatePackageReadme('my-slides.ppsx');

		expect(readme).toContain('Presentation Package');
		expect(readme).toContain('"my-slides.ppsx"');
		expect(readme).toContain('/media');
		expect(readme).toContain(new Date().toLocaleDateString());
		vi.useRealTimers();
	});
});
