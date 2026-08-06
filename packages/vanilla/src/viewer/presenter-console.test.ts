/**
 * Audience effects are painted over the running show, so none of them may
 * accept pointer input.
 *
 * The blackout sheet is the one that bites: PowerPoint advances the show when
 * the presenter clicks a blanked screen, and the shared blackboard rules raise
 * the ink overlay ABOVE the blackout while blanked so strokes stay visible. A
 * sheet that swallowed presses would strand a blacked-out show with nothing
 * clickable, which is exactly what three of the five bindings shipped.
 */
import { PRESENT_BLACKOUT_Z } from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderAudienceEffects } from './presenter-console';

function snapshot(overrides: Partial<PresentationSnapshot> = {}): PresentationSnapshot {
	return {
		blackout: 'none',
		slideIndex: 0,
		subtitlesVisible: false,
		...overrides,
	} as PresentationSnapshot;
}

describe('renderAudienceEffects', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.append(container);
	});

	it('paints nothing while the show is live', () => {
		renderAudienceEffects(container, snapshot());

		expect(container.querySelector('[data-pptx-blackout]')).toBeNull();
	});

	it('stacks the blackout sheet at the shared level and lets presses through it', () => {
		renderAudienceEffects(container, snapshot({ blackout: 'black' }));

		const blackout = container.querySelector<HTMLElement>('[data-pptx-blackout]');
		expect(blackout).not.toBeNull();
		expect(blackout?.style.zIndex).toBe(String(PRESENT_BLACKOUT_Z));
		expect(blackout?.style.pointerEvents).toBe('none');
	});

	it('replaces the previous effects rather than stacking a second sheet', () => {
		renderAudienceEffects(container, snapshot({ blackout: 'black' }));
		renderAudienceEffects(container, snapshot({ blackout: 'white' }));

		expect(container.querySelectorAll('[data-pptx-blackout]')).toHaveLength(1);
	});
});
