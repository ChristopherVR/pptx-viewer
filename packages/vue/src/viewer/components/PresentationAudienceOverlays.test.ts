/**
 * The audience overlays are all decorative.
 *
 * Every sheet this component paints sits on top of the running show, so any of
 * them that accepts pointer input steals it from the surface underneath. That
 * matters most for the blackout: PowerPoint advances the show when the
 * presenter clicks a blanked screen, and the ink overlay (which the shared
 * blackboard rules raise ABOVE the blackout while blanked) has to keep
 * receiving the presses that draw on it. A sheet that swallowed input would
 * leave a blacked-out show with nothing to click.
 */
import { mount } from '@vue/test-utils';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import PresentationAudienceOverlays from './PresentationAudienceOverlays.vue';

function snapshot(overrides: Partial<PresentationSnapshot> = {}): PresentationSnapshot {
	return {
		blackout: 'none',
		slideIndex: 0,
		subtitlesVisible: false,
		...overrides,
	} as PresentationSnapshot;
}

describe('presentation audience overlays', () => {
	it('paints no blackout sheet while the show is live', () => {
		const wrapper = mount(PresentationAudienceOverlays, { props: { snapshot: snapshot() } });

		expect(wrapper.find('[data-pptx-blackout]').exists()).toBeFalsy();
	});

	it('lets presses through the blackout sheet so a blanked show still advances', () => {
		const wrapper = mount(PresentationAudienceOverlays, {
			props: { snapshot: snapshot({ blackout: 'black' }) },
		});

		const blackout = wrapper.find('[data-pptx-blackout]');
		expect(blackout.exists()).toBeTruthy();
		expect(blackout.classes()).toContain('pointer-events-none');
	});

	it('keeps the laser dot and the caption line decorative too', () => {
		const wrapper = mount(PresentationAudienceOverlays, {
			props: {
				snapshot: snapshot({
					pointer: { tool: 'laser', x: 0.5, y: 0.5 },
					subtitlesVisible: true,
					caption: 'live caption',
				} as Partial<PresentationSnapshot>),
			},
		});

		for (const node of wrapper.findAll('div')) {
			expect(node.classes()).toContain('pointer-events-none');
		}
	});
});
