import type { RibbonControlId } from 'pptx-viewer-shared';

/** Native callbacks remain in the caller; this adapter has no document state. */
export function createSharedRibbonCommand(
	doc: Document,
	options: {
		id: RibbonControlId;
		label: string;
		title?: string;
		icon: string;
		onCommand(): void;
	},
) {
	const el = doc.createElement('pptx-ui-ribbon-command');
	el.setAttribute('data-ribbon-control', options.id);
	el.setAttribute('label', options.label);
	el.setAttribute('title', options.title ?? options.label);
	el.setAttribute('icon', options.icon);
	el.setAttribute('compact', '');
	el.addEventListener('command-request', options.onCommand);
	const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
	return {
		el,
		btn,
		setDisabled(value: boolean) {
			el.toggleAttribute('disabled', value);
		},
		setActive(value: boolean) {
			el.toggleAttribute('active', value);
		},
		setExpanded(value: boolean) {
			el.setAttribute('expanded', String(value));
		},
	};
}
export type SharedRibbonCommandHandle = ReturnType<typeof createSharedRibbonCommand>;
