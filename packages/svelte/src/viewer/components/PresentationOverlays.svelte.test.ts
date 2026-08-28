/**
 * The blackout sheet stays decorative.
 *
 * PowerPoint advances the show when the presenter clicks a blanked screen, and
 * the shared blackboard rules raise the ink overlay ABOVE the blackout while
 * blanked so strokes drawn on the "blackboard" stay visible. A sheet that
 * accepted pointer input would swallow both, stranding a blacked-out show with
 * nothing clickable. Three of the five bindings shipped exactly that, so the
 * rule is now asserted in each of them.
 *
 * jsdom gives no layout and scoped Svelte styles are compiled away, so the
 * component's own CSS text is the thing under test.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const overlaySource = readFileSync(
	[
		'src/viewer/components/PresentationOverlays.svelte',
		'packages/svelte/src/viewer/components/PresentationOverlays.svelte',
	]
		.map((candidate) => resolve(process.cwd(), candidate))
		.find((candidate) => existsSync(candidate))!,
	'utf8',
);

describe('presentation overlays blackout', () => {
	it('stamps the framework-neutral e2e hook on the blackout sheet', () => {
		expect(overlaySource).toContain('data-pptx-blackout');
	});

	it('lets presses through the blackout sheet so a blanked show still advances', () => {
		const rule = /\.presenter-blackout\s*\{(?<body>[^}]*)\}/u.exec(overlaySource);
		expect(rule?.groups?.['body']).toMatch(/pointer-events:\s*none/u);
	});
});

describe('presentation right-click menu wiring', () => {
	it('renders the menu gated by parityUi.presentationContextMenu', () => {
		expect(overlaySource).toContain('parityUi.presentationContextMenu');
		expect(overlaySource).toContain('<PresentationContextMenu');
	});

	it('requests every capability this binding actually supports', () => {
		expect(overlaySource).toContain('seeAllSlides: true');
		expect(overlaySource).toContain('presenterView: true');
		expect(overlaySource).toContain('pointerTools: true');
		expect(overlaySource).toContain('eraseInk: true');
		expect(overlaySource).toContain('blankBlack: true');
		expect(overlaySource).toContain('blankWhite: true');
	});

	it('threads Options > Advanced > "Show popup toolbar" into the show toolbar', () => {
		expect(overlaySource).toContain(
			'popupToolbarEnabled={optionsState.options.advanced.slideShowShowPopupToolbar}',
		);
	});
});
