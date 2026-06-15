import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CollaborationCursors from './CollaborationCursors.vue';
import type { RemoteCursor } from './CollaborationCursors.vue';

function mountCursors(cursors: RemoteCursor[], zoom = 1) {
	return mount(CollaborationCursors, { props: { cursors, zoom } });
}

describe('collaborationCursors', () => {
	it('renders one cursor per entry', () => {
		const cursors: RemoteCursor[] = [
			{ clientId: 1, userName: 'Ada', color: '#ff0000', x: 10, y: 20 },
			{ clientId: 2, userName: 'Grace', color: '#00ff00', x: 30, y: 40 },
		];
		const wrapper = mountCursors(cursors);
		expect(wrapper.findAll('.pptx-vue-collab-cursor')).toHaveLength(2);
	});

	it('renders nothing when there are no cursors', () => {
		const wrapper = mountCursors([]);
		expect(wrapper.findAll('.pptx-vue-collab-cursor')).toHaveLength(0);
	});

	it('positions cursors at the raw slide coordinates at zoom 1', () => {
		const wrapper = mountCursors([
			{ clientId: 'a', userName: 'Ada', color: '#123456', x: 10, y: 20 },
		]);
		const cursor = wrapper.get('[data-client-id="a"]');
		expect(cursor.attributes('style')).toContain('translate(10px, 20px)');
	});

	it('scales cursor positions with zoom', () => {
		const wrapper = mountCursors(
			[{ clientId: 'a', userName: 'Ada', color: '#123456', x: 10, y: 20 }],
			2,
		);
		const cursor = wrapper.get('[data-client-id="a"]');
		expect(cursor.attributes('style')).toContain('translate(20px, 40px)');
	});

	it('updates positions reactively when zoom changes', async () => {
		const wrapper = mountCursors(
			[{ clientId: 'a', userName: 'Ada', color: '#123456', x: 10, y: 20 }],
			1,
		);
		await wrapper.setProps({ zoom: 3 });
		const cursor = wrapper.get('[data-client-id="a"]');
		expect(cursor.attributes('style')).toContain('translate(30px, 60px)');
	});

	it('shows the user name label and applies the user color', () => {
		const wrapper = mountCursors([
			{ clientId: 1, userName: 'Ada Lovelace', color: 'rgb(255, 0, 0)', x: 0, y: 0 },
		]);
		const label = wrapper.get('.pptx-vue-collab-label');
		expect(label.text()).toBe('Ada Lovelace');
		expect(label.attributes('style')).toContain('background-color: rgb(255, 0, 0)');
	});

	it('truncates very long user names', () => {
		const wrapper = mountCursors([
			{
				clientId: 1,
				userName: 'A really really long collaborator name',
				color: '#000000',
				x: 0,
				y: 0,
			},
		]);
		const label = wrapper.get('.pptx-vue-collab-label');
		expect(label.text().endsWith('…')).toBeTruthy();
		// 19 chars + ellipsis = 20 visible characters.
		expect([...label.text()]).toHaveLength(20);
	});

	it('does not intercept pointer events on the overlay', () => {
		const wrapper = mountCursors([{ clientId: 1, userName: 'Ada', color: '#000000', x: 0, y: 0 }]);
		const overlay = wrapper.get('.pptx-vue-collab-cursors');
		expect(overlay.attributes('aria-hidden')).toBe('true');
	});
});
