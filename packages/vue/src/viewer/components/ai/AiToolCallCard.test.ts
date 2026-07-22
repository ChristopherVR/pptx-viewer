import { mount } from '@vue/test-utils';
import type { RenderableToolPart } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import AiToolCallCard from './AiToolCallCard.vue';

/**
 * AiToolCallCard tests: the friendly, non-technical activity row. It reads plain
 * language ("Looked at slide 5", "Merged two tables"), a Working/Done/Failed
 * status, and NEVER leaks element ids in the default view - the raw args live
 * only inside the collapsed Details disclosure.
 */
function toolPart(
	toolName: string,
	input: unknown,
	state: string,
	errorText?: string,
): RenderableToolPart {
	return {
		kind: 'tool',
		toolName,
		toolCallId: 'c1',
		state,
		input,
		output: undefined,
		errorText,
	};
}

/** Text visible WITHOUT expanding any `<details>` disclosure. */
function visibleText(el: HTMLElement): string {
	const clone = el.cloneNode(true) as HTMLElement;
	for (const d of clone.querySelectorAll('details')) {
		d.remove();
	}
	return clone.textContent ?? '';
}

describe('aiToolCallCard', () => {
	it('shows a friendly past-tense activity line with a Done status', () => {
		const wrapper = mount(AiToolCallCard, {
			props: { part: toolPart('get_slide', { slideIndex: 4 }, 'output-available') },
		});
		const shown = visibleText(wrapper.element as HTMLElement);
		expect(shown).toContain('Looked at slide 5');
		expect(shown).toContain('Done');
	});

	it('reads present tense while the tool is still running', () => {
		const wrapper = mount(AiToolCallCard, {
			props: { part: toolPart('merge_tables', { slideIndex: 2 }, 'input-available') },
		});
		const shown = visibleText(wrapper.element as HTMLElement);
		expect(shown).toContain('Merging two tables on slide 3');
		expect(shown).toContain('Working');
	});

	it('never leaks element ids in the default view; raw args live in Details', () => {
		const input = {
			slideIndex: 2,
			elementIdA: 'ppt/slides/slide3.xml-graphicFrame-178',
			elementIdB: 'ppt/slides/slide3.xml-graphicFrame-9',
		};
		const wrapper = mount(AiToolCallCard, {
			props: { part: toolPart('merge_tables', input, 'output-available') },
		});
		const shown = visibleText(wrapper.element as HTMLElement);
		expect(shown).toContain('Merged two tables on slide 3');
		expect(shown).not.toContain('graphicFrame');
		expect(shown).not.toContain('ppt/slides');
		expect(shown).not.toContain('178');
		// The raw args are still available, but only inside the collapsed disclosure.
		const details = wrapper.find('details');
		expect(details.exists()).toBeTruthy();
		expect(details.text()).toContain('ppt/slides');
	});

	it('surfaces an error message when the tool failed', () => {
		const wrapper = mount(AiToolCallCard, {
			props: {
				part: toolPart('update_element', { slideIndex: 0 }, 'output-error', 'Element not found'),
			},
		});
		const shown = visibleText(wrapper.element as HTMLElement);
		expect(shown).toContain('Failed');
		expect(shown).toContain('Element not found');
	});
});
