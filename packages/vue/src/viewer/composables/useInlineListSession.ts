import type { PptxElement } from 'pptx-viewer-core';
import { createInlineListModelObserver } from 'pptx-viewer-shared';
import type {
	CollaborationInlineEditor,
	InlineListController,
	InlineTextEditSnapshot,
} from 'pptx-viewer-shared';
import { toRaw, watch } from 'vue';

/** Viewer-local controller and model-history boundary, shared by normal and master editors. */
export function useInlineListSession(
	readElement: () => PptxElement | undefined,
	retire: () => void,
) {
	let controller: InlineListController | undefined;
	let observer: ReturnType<typeof createInlineListModelObserver> | undefined;
	function connected(): CollaborationInlineEditor | undefined {
		return controller && 'checkModel' in controller
			? (controller as CollaborationInlineEditor)
			: undefined;
	}
	function read(): InlineTextEditSnapshot | undefined {
		if (!controller || !observer) {
			return undefined;
		}
		const element = readElement();
		const native = connected();
		if (native) {
			if (!native.checkModel(element ? toRaw(element) : undefined)) {
				return undefined;
			}
			const current = native.read();
			return current.kind === 'supported' ? current.snapshot : undefined;
		}
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
		isConnected: () => Boolean(connected()),
		readAccepted: () => {
			const native = connected();
			const element = readElement();
			return native?.checkModel(element ? toRaw(element) : undefined)
				? native.readAccepted()
				: undefined;
		},
		isPending: () => {
			const current = connected()?.read();
			return (
				current?.kind === 'unsupported' &&
				(current.reason === 'input-active' || current.reason === 'composition-active')
			);
		},
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
