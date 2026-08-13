import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import DesignSection from './DesignSection.vue';

/**
 * Design > Slide Size used to run `onOpenDocumentProperties`, so the button
 * opened a dialog with no slide-size control in it - the same mis-wiring
 * Angular, Vanilla and Svelte each shipped independently. It now has its own
 * callback, which the host points at the inspector's SLIDE SIZE card.
 */
function mountSection(handlers: {
	onOpenSlideSize?: () => void;
	onOpenDocumentProperties?: () => void;
}) {
	return mount(DesignSection, {
		props: {
			canEdit: true,
			onToggleThemeGallery: () => {},
			isThemeGalleryOpen: false,
			onToggleThemeEditor: () => {},
			isThemeEditorOpen: false,
			...handlers,
		},
		global: { mocks: { $t: (key: string) => key } },
	});
}

function slideSizeButton(wrapper: ReturnType<typeof mountSection>) {
	return wrapper.findAll('button').find((button) => button.text().includes('Slide Size'));
}

describe('designSection slide size', () => {
	it('opens the slide-size surface, not Document Properties', async () => {
		const onOpenSlideSize = vi.fn();
		const onOpenDocumentProperties = vi.fn();
		const wrapper = mountSection({ onOpenSlideSize, onOpenDocumentProperties });

		await slideSizeButton(wrapper)?.trigger('click');

		expect(onOpenSlideSize).toHaveBeenCalledOnce();
		expect(onOpenDocumentProperties).not.toHaveBeenCalled();
	});

	it('falls back to the old callback for a host that supplies only that', async () => {
		const onOpenDocumentProperties = vi.fn();
		const wrapper = mountSection({ onOpenDocumentProperties });

		await slideSizeButton(wrapper)?.trigger('click');

		expect(onOpenDocumentProperties).toHaveBeenCalledOnce();
	});
});
