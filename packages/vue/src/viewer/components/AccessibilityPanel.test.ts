import { mount } from '@vue/test-utils';
import type { AccessibilityIssue } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import AccessibilityPanel from './AccessibilityPanel.vue';

function issue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
	return {
		type: 'missingAltText',
		severity: 'error',
		slideIndex: 0,
		message: 'Image is missing alternative text.',
		suggestion: 'Add a description.',
		...overrides,
	};
}

describe('accessibilityPanel', () => {
	it('renders issues grouped by severity with type, message and slide', () => {
		const issues: AccessibilityIssue[] = [
			issue({ type: 'missingAltText', severity: 'error', slideIndex: 0 }),
			issue({
				type: 'lowContrast',
				severity: 'warning',
				slideIndex: 2,
				message: 'Text contrast is too low.',
			}),
		];
		const wrapper = mount(AccessibilityPanel, { props: { issues } });

		expect(wrapper.find('.pptx-vue-a11y-panel__empty').exists()).toBeFalsy();

		const items = wrapper.findAll('.pptx-vue-a11y-issue');
		expect(items).toHaveLength(2);

		expect(wrapper.find('[data-severity="error"].pptx-vue-a11y-group').exists()).toBeTruthy();
		expect(wrapper.find('[data-severity="warning"].pptx-vue-a11y-group').exists()).toBeTruthy();

		const text = wrapper.text();
		expect(text).toContain('Missing alt text');
		expect(text).toContain('Image is missing alternative text.');
		expect(text).toContain('Slide 1');
		expect(text).toContain('Low contrast');
		expect(text).toContain('Slide 3');
	});

	it('emits select-slide with the issue slide index when clicked', async () => {
		const issues: AccessibilityIssue[] = [issue({ slideIndex: 4 })];
		const wrapper = mount(AccessibilityPanel, { props: { issues } });

		await wrapper.find('.pptx-vue-a11y-issue__button').trigger('click');

		const emitted = wrapper.emitted('select-slide');
		expect(emitted).toBeDefined();
		expect(emitted?.[0]).toStrictEqual([4]);
	});

	it('shows the empty state when there are no issues', () => {
		const wrapper = mount(AccessibilityPanel, { props: { issues: [] } });

		expect(wrapper.find('.pptx-vue-a11y-panel__empty').exists()).toBeTruthy();
		expect(wrapper.text()).toContain('No issues found');
		expect(wrapper.findAll('.pptx-vue-a11y-issue')).toHaveLength(0);
	});
});
