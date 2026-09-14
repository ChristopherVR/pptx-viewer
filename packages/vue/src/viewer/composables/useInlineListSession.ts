import type { PptxElement } from 'pptx-viewer-core';
import { createInlineListModelObserver } from 'pptx-viewer-shared';
import type { InlineListController, InlineTextEditSnapshot } from 'pptx-viewer-shared';
import { toRaw, watch } from 'vue';

/** Viewer-local controller and model-history boundary, shared by normal and master editors. */
export function useInlineListSession(
	readElement: () => PptxElement | undefined,
	retire: () => void,
) {
	let controller: InlineListController | undefined;
	let observer: ReturnType<typeof createInlineListModelObserver> | undefined;
	function read(): InlineTextEditSnapshot | undefined {
		if (!controller || !observer) {
			return undefined;
		}
		const element = readElement();
		let current = controller.read();
		const change = observer.check(element ? toRaw(element) : undefined, current);
		if (change.kind === 'format') {
			current = controller.format(change.snapshot);
		}
		if (change.kind === 'retire' || (change.kind === 'format' && current.kind !== 'supported')) {
			controller.dispose();
			controller = undefined;
			observer = undefined;
			retire();
			return undefined;
		}
		return current.kind === 'supported'
			? current.snapshot
			: element
				? { elementId: element.id, text: current.text }
				: undefined;
	}
	watch(
		readElement,
		() => {
			read();
		},
		{ flush: 'sync' },
	);
	return {
		read,
		end(): void {
			controller?.dispose();
			controller = undefined;
			observer = undefined;
			retire();
		},
		register(event: { controller: InlineListController; active: boolean }): void {
			if (event.active) {
				const element = readElement();
				if (!element) {
					return;
				}
				controller = event.controller;
				observer = createInlineListModelObserver(toRaw(element));
			} else if (controller === event.controller) {
				controller = undefined;
				observer = undefined;
			}
		},
		format(snapshot: InlineTextEditSnapshot): boolean {
			const result = controller?.format(snapshot);
			if (result?.kind !== 'supported') {
				return false;
			}
			observer?.expect(snapshot);
			return true;
		},
	};
}
