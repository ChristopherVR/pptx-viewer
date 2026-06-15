import { mount } from '@vue/test-utils';
import type { PptxNotesMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import NotesMasterPanel from './NotesMasterPanel.vue';

describe('notesMasterPanel', () => {
	it('shows an empty message when there is no notes master', () => {
		const wrapper = mount(NotesMasterPanel, { props: { notesMaster: undefined } });
		expect(wrapper.find('[data-testid="notes-master-panel-empty"]').exists()).toBeTruthy();
	});

	it('renders the background swatch', () => {
		const master: PptxNotesMaster = { path: 'notes', backgroundColor: '#abcdef' };
		const wrapper = mount(NotesMasterPanel, { props: { notesMaster: master } });
		expect(wrapper.find('[data-testid="notes-master-bg-swatch"]').exists()).toBeTruthy();
	});

	it('renders human-readable placeholder labels', () => {
		const master: PptxNotesMaster = {
			path: 'notes',
			placeholders: [{ type: 'body' }, { type: 'sldImg' }],
		};
		const wrapper = mount(NotesMasterPanel, { props: { notesMaster: master } });
		expect(wrapper.findAll('[data-testid="notes-master-placeholder"]')).toHaveLength(2);
		expect(wrapper.text()).toContain('Notes Body');
		expect(wrapper.text()).toContain('Slide Image');
	});

	it('shows a no-placeholders message when there are none', () => {
		const master: PptxNotesMaster = { path: 'notes' };
		const wrapper = mount(NotesMasterPanel, { props: { notesMaster: master } });
		expect(wrapper.text()).toContain('No placeholders');
	});
});
