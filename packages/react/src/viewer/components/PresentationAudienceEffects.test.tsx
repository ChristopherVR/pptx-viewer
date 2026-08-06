// @vitest-environment happy-dom
/**
 * The audience effects layer is decorative in its entirety.
 *
 * It covers the whole show surface, so if it accepted pointer input nothing
 * underneath would ever be clickable. The blackout sheet is the case that
 * matters: PowerPoint advances the show when the presenter clicks a blanked
 * screen, and the shared blackboard rules raise the ink overlay ABOVE the
 * blackout while blanked so strokes stay visible. React gets this right by
 * hanging `pointer-events: none` on the wrapper rather than on each sheet,
 * which is easy to lose in a refactor: hence this guard.
 */
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PresentationAudienceEffects } from './PresentationAudienceEffects';

function snapshot(overrides: Partial<PresentationSnapshot> = {}): PresentationSnapshot {
	return {
		blackout: 'none',
		slideIndex: 0,
		subtitlesVisible: false,
		...overrides,
	} as PresentationSnapshot;
}

/** Parse the rendered markup so the guard reads the real DOM, not a string. */
function renderLayer(overrides: Partial<PresentationSnapshot> = {}): HTMLElement {
	const host = document.createElement('div');
	host.innerHTML = renderToStaticMarkup(
		<PresentationAudienceEffects snapshot={snapshot(overrides)} />,
	);
	return host;
}

describe('presentation audience effects', () => {
	it('paints no blackout sheet while the show is live', () => {
		expect(renderLayer().querySelector('[data-pptx-blackout]')).toBeNull();
	});

	it('lets presses through the blackout sheet so a blanked show still advances', () => {
		const host = renderLayer({ blackout: 'black' });
		const blackout = host.querySelector('[data-pptx-blackout]');
		expect(blackout).not.toBeNull();

		// The sheet inherits the rule from the layer wrapper; either placement is
		// fine as long as nothing between it and the root turns events back on.
		let node: Element | null = blackout;
		let decorative = false;
		while (node && node !== host) {
			const classes = node.className;
			if (classes.includes('pointer-events-none')) {
				decorative = true;
			}
			if (classes.includes('pointer-events-auto')) {
				decorative = false;
			}
			node = node.parentElement;
		}
		expect(decorative).toBeTruthy();
	});
});
