import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildSharingPackage } from './package-sharing';

describe('buildSharingPackage', () => {
	it('bundles the presentation and generated readme', async () => {
		const blob = await buildSharingPackage(new Uint8Array([1, 2, 3]), 'deck.pptx');
		const zip = await JSZip.loadAsync(await blob.arrayBuffer());

		await expect(
			zip.file('presentation-package/deck.pptx')?.async('uint8array'),
		).resolves.toStrictEqual(new Uint8Array([1, 2, 3]));
		await expect(zip.file('presentation-package/README.txt')?.async('string')).resolves.toContain(
			'"deck.pptx"',
		);
	});
});
