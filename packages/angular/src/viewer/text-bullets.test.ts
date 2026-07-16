import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveAngularParagraphBullet } from './text-bullets';

describe('angular picture bullet projection', () => {
	it('projects a resolved image and DrawingML percentage size', () => {
		const segment: TextSegment = {
			text: '',
			style: { fontSize: 16 },
			bulletInfo: {
				imageDataUrl: 'data:image/png;base64,iVBOR',
				imageRelId: 'rId5',
				sizePercent: 150,
			},
		};
		const bullet = resolveAngularParagraphBullet(segment, 16);
		expect(bullet?.marker).toBeUndefined();
		expect(bullet?.picture).toMatchObject({
			src: 'data:image/png;base64,iVBOR',
			sizePx: 24,
			accessibleLabel: 'Bullet',
		});
	});

	it('retains an accessible glyph fallback for unresolved raw picture XML', () => {
		const segment: TextSegment = {
			text: '',
			style: {},
			bulletInfo: { imageBlipFillXml: '<a:blipFill />' },
		};
		const bullet = resolveAngularParagraphBullet(segment, 16);
		expect(bullet?.marker).toBe('•');
		expect(bullet?.picture?.src).toBeUndefined();
		expect(bullet?.picture).toMatchObject({
			sizePx: 16,
			accessibleLabel: 'Bullet',
		});
	});
});
