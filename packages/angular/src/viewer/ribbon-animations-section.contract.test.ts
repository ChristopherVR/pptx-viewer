/**
 * The Animations ribbon tab's Preview button used to emit `present`, which
 * `power-point-viewer.component.ts` wires (via `ribbon-content-secondary` and
 * `ribbon.component.ts`) to `presentationMode.present()`, starting the FULL
 * slide show and leaving the editor. It must instead play the selected
 * element's own effect in place, via the shared `playAnimationRibbonPreview`
 * (the same function react/vue/svelte/vanilla's ribbons call).
 *
 * Angular has no TestBed here (see `vitest.config.ts`), so the guard reads
 * the component source, matching the other `*.contract.test.ts` files in this
 * package.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
	path.join(import.meta.dirname, 'ribbon-animations-section.component.ts'),
	'utf8',
);
const PARENT_SOURCE = readFileSync(
	path.join(import.meta.dirname, 'ribbon-content-secondary.component.ts'),
	'utf8',
);

describe('ribbon animations section preview contract', () => {
	it('plays the shared in-place preview, not a `present` re-emission', () => {
		expect(SOURCE).toContain('(click)="previewAnimation()"');
		expect(SOURCE).not.toContain('(click)="present.emit()"');
		expect(SOURCE).toContain('playAnimationRibbonPreview(document,');
	});

	it('no longer declares a `present` output (it had no other use)', () => {
		expect(SOURCE).not.toMatch(/readonly present\s*=\s*output/u);
	});

	it("the parent no longer wires this section's preview button to present()", () => {
		const animationsBlock = PARENT_SOURCE.slice(
			PARENT_SOURCE.indexOf("@case ('animations')"),
			PARENT_SOURCE.indexOf("@case ('help')"),
		);
		expect(animationsBlock).toContain('pptx-ribbon-animations-section');
		expect(animationsBlock).not.toContain('(present)=');
	});
});
