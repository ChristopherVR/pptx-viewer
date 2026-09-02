import type { PptxActiveXControl } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildActiveXControlsOverlay } from './activex-controls-overlay';

describe('buildActiveXControlsOverlay', () => {
	it('draws a labelled placeholder badge for a control with no fallback picture', () => {
		const control: PptxActiveXControl = { relId: 'rId9', name: 'CommandButton1' };
		const overlay = buildActiveXControlsOverlay(document, [control], { width: 1280, height: 720 });

		const badge = overlay.querySelector('.pptxv-activex-overlay-placeholder') as HTMLElement;
		expect(badge).not.toBeNull();
		expect(badge.textContent).toBe('CommandButton1');
		expect(overlay.querySelector('img')).toBeNull();
	});

	it('falls back to a generic label when the control has none', () => {
		const control: PptxActiveXControl = { relId: 'rId9' };
		const overlay = buildActiveXControlsOverlay(document, [control], { width: 1280, height: 720 });

		expect(overlay.querySelector('.pptxv-activex-overlay-placeholder')?.textContent).toBe(
			'ActiveX control',
		);
	});

	it('stacks multiple geometry-less controls instead of drawing them on top of each other', () => {
		const controls: PptxActiveXControl[] = [
			{ relId: 'rId1', name: 'A' },
			{ relId: 'rId2', name: 'B' },
		];
		const overlay = buildActiveXControlsOverlay(document, controls, { width: 1280, height: 720 });

		const badges = Array.from(
			overlay.querySelectorAll<HTMLElement>('.pptxv-activex-overlay-placeholder'),
		);
		expect(badges).toHaveLength(2);
		expect(badges[0]?.style.top).not.toBe(badges[1]?.style.top);
	});
});
