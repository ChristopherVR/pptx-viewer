import type { HTMLInputAttributes, HTMLSelectAttributes } from 'svelte/elements';

declare module 'svelte/elements' {
	interface SvelteHTMLElements {
		'pptx-ui-select': HTMLSelectAttributes;
		'pptx-ui-checkbox': HTMLInputAttributes;
	}
}
