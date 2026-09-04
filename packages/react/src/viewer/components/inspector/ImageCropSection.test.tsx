import type { PptxImageElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { ImageCropSection } from './ImageCropSection';

/**
 * G7 (OpenXML parity audit, D3): `a:picLocks/@noCrop` was parsed and
 * round-tripped but never enforced - the crop sliders stayed live/draggable
 * regardless of the lock, gated only on the document-level `canEdit` flag.
 */
function picture(overrides: Partial<PptxImageElement> = {}): PptxImageElement {
	return {
		id: 'pic1',
		type: 'image',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageData: 'data:image/png;base64,',
		...overrides,
	} as unknown as PptxImageElement;
}

describe('imageCropSection with a:picLocks/@noCrop', () => {
	it('disables every crop slider and the reset button when noCrop is set', () => {
		const markup = renderToStaticMarkup(
			<ImageCropSection
				selectedElement={picture({ locks: { noCrop: true } })}
				canEdit
				onUpdateElement={() => {}}
			/>,
		);
		// 4 sliders + 1 reset button, all disabled.
		expect(markup.match(/disabled=""/gu)?.length).toBe(5);
	});

	it('leaves the sliders enabled on an editable, unlocked picture', () => {
		const markup = renderToStaticMarkup(
			<ImageCropSection selectedElement={picture()} canEdit onUpdateElement={() => {}} />,
		);
		expect(markup).not.toContain('disabled=""');
	});
});
