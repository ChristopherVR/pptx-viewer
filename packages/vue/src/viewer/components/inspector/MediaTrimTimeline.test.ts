import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MediaTrimTimeline from './MediaTrimTimeline.vue';

/**
 * G19 regression: `trimEndMs` is `p14:trim/@end`'s distance from the clip's
 * tail (COM-verified), not an absolute stop time. The scrubber used to print
 * and re-emit it as an absolute position.
 */
describe('media trim timeline (vue)', () => {
	function mountTimeline(trimEndMs: number) {
		return mount(MediaTrimTimeline, {
			props: {
				duration: 20,
				trimStartMs: 0,
				trimEndMs,
				currentTime: 0,
				bookmarks: [],
				canEdit: true,
			},
			attachTo: document.body,
		});
	}

	it('labels the end as duration minus the tail trim', () => {
		const wrapper = mountTimeline(5000);
		expect(wrapper.findAll('span')[1]?.text()).toBe('15.0s');
		expect(mountTimeline(0).findAll('span')[1]?.text()).toBe('20.0s');
	});

	it('emits a dragged end handle as a distance from the tail', async () => {
		const wrapper = mountTimeline(0);
		const bar = wrapper.find<HTMLElement>('.relative.h-5').element;
		bar.getBoundingClientRect = () =>
			({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20 }) as DOMRect;
		const handles = wrapper.findAll('.cursor-ew-resize');
		await handles[1]!.trigger('pointerdown');
		// 75% along the bar = 15s into a 20s clip -> 5000ms off the tail.
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }));
		const emitted = wrapper.emitted('trim-change');
		expect(emitted?.at(-1)?.[0]).toStrictEqual({ trimStartMs: 0, trimEndMs: 5000 });
		wrapper.unmount();
	});
});
