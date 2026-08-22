/* oxlint-disable eslint/one-var -- independent per-test locals, not intended as one statement */
import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxTextStyleLevels } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import NotesPanel from './NotesPanel.vue';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId2',
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

/**
 * Regression test for wiring `PptxData.notesMaster.notesStyle` through
 * `NotesPanel.vue` -> `useNotesEditor` -> the shared `resolveNotesSegments`.
 * A deck's authored notes-text defaults (here, a level-0 font size of 32px =
 * 24pt) must reach the rich contentEditable surface for a plain-text note
 * that carries no explicit style of its own, instead of being silently
 * dropped.
 */
describe('useNotesEditor notesStyle wiring (via NotesPanel)', () => {
	it('applies the notes master level-0 font size to a plain note with no explicit style', async () => {
		const notesStyle: PptxTextStyleLevels = {
			0: { fontSize: 32 },
		};
		const wrapper = mount(NotesPanel, {
			props: {
				slide: makeSlide({ notes: 'Remember quarterly goals.' }),
				notesStyle,
			},
		});
		await nextTick();

		const rich = wrapper.get('.pptx-vue-notes-rich');
		expect(rich.element.innerHTML).toContain('Remember quarterly goals.');
		// 32px * 0.75 = 24pt (PlaceholderTextLevelStyle.fontSize is px; TextStyle
		// expects pt, per notes-style-cascade.ts's PX_TO_PT conversion).
		expect(rich.element.innerHTML).toContain('font-size:24pt');
	});

	it('never overrides a segment style the deck already set explicitly', async () => {
		const notesStyle: PptxTextStyleLevels = {
			0: { fontSize: 32 },
		};
		const wrapper = mount(NotesPanel, {
			props: {
				slide: makeSlide({
					notes: 'Bold note',
					notesSegments: [{ text: 'Bold note', style: { bold: true, fontSize: 10 } }],
				}),
				notesStyle,
			},
		});
		await nextTick();

		const html = wrapper.get('.pptx-vue-notes-rich').element.innerHTML;
		expect(html).toContain('font-weight:700');
		// The segment's own 10pt must win over the notes-style 24pt default.
		expect(html).toContain('font-size:10pt');
		expect(html).not.toContain('font-size:24pt');
	});

	it('re-seeds with the current notesStyle prop after a slide swap', async () => {
		const notesStyle: PptxTextStyleLevels = {
			0: { fontSize: 32 },
		};
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ id: 'a', notes: 'first' }), notesStyle },
		});
		await nextTick();
		expect(wrapper.get('.pptx-vue-notes-rich').element.innerHTML).toContain('font-size:24pt');

		await wrapper.setProps({ slide: makeSlide({ id: 'b', notes: 'second' }), notesStyle });
		await nextTick();
		const html = wrapper.get('.pptx-vue-notes-rich').element.innerHTML;
		expect(html).toContain('second');
		expect(html).toContain('font-size:24pt');
	});

	it('is fully backward compatible when notesStyle is omitted', async () => {
		const wrapper = mount(NotesPanel, {
			props: { slide: makeSlide({ notes: 'Remember quarterly goals.' }) },
		});
		await nextTick();
		const html = wrapper.get('.pptx-vue-notes-rich').element.innerHTML;
		expect(html).toContain('Remember quarterly goals.');
		expect(html).not.toContain('font-size:24pt');
	});
});
