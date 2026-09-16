import { attachRotateHandlePlacement } from 'pptx-viewer-shared';
import type { ObjectDirective } from 'vue';

const cleanups = new WeakMap<HTMLElement, () => void>();

export const vRotateHandlePlacement: ObjectDirective<HTMLElement> = {
	mounted(button) {
		cleanups.set(
			button,
			attachRotateHandlePlacement(button, {
				stem: button.parentElement?.querySelector('[data-pptx-rotate-stem]'),
			}),
		);
	},
	beforeUnmount(button) {
		cleanups.get(button)?.();
		cleanups.delete(button);
	},
};
