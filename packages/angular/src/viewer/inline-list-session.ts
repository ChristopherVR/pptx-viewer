import type { PptxElement } from 'pptx-viewer-core';

import { createInlineListModelObserver } from '../internal/shared';
import type {
	CollaborationInlineEditor,
	InlineListController,
	InlineTextEditSnapshot,
} from '../internal/shared';

/** Scoped normal/master list state; model transactions remain owned by the existing editor. */
export class InlineListSession {
	private controller?: InlineListController;
	private observer?: ReturnType<typeof createInlineListModelObserver>;
	private connected(): CollaborationInlineEditor | undefined {
		return this.controller && 'checkModel' in this.controller
			? (this.controller as CollaborationInlineEditor)
			: undefined;
	}
	isConnected(): boolean {
		return Boolean(this.connected());
	}
	readAccepted(): InlineTextEditSnapshot | undefined {
		const native = this.connected();
		return native?.checkModel(this.element()) ? native.readAccepted() : undefined;
	}
	isPending(): boolean {
		const native = this.connected();
		const current = native?.checkModel(this.element()) ? native.read() : undefined;
		return (
			current?.kind === 'unsupported' &&
			(current.reason === 'input-active' || current.reason === 'composition-active')
		);
	}
	constructor(
		private readonly element: () => PptxElement | undefined,
		private readonly retire: () => void,
	) {}
	register(event: { controller: InlineListController; active: boolean }): void {
		if (event.active) {
			const element = this.element();
			if (!element) {
				return;
			}
			this.controller = event.controller;
			this.observer = createInlineListModelObserver(element);
		} else if (this.controller === event.controller) {
			this.controller = undefined;
			this.observer = undefined;
		}
	}
	read(): InlineTextEditSnapshot | undefined {
		if (!this.controller || !this.observer) {
			return undefined;
		}
		const element = this.element();
		const native = this.connected();
		if (native) {
			if (!native.checkModel(element)) {
				return undefined;
			}
			const current = native.read();
			return current.kind === 'supported' ? current.snapshot : undefined;
		}
		let current = this.controller.read();
		const change = this.observer.check(element, current);
		if (change.kind === 'format') {
			current = this.controller.format(change.snapshot);
		}
		if (change.kind === 'retire' || (change.kind === 'format' && current.kind !== 'supported')) {
			this.controller.dispose();
			this.controller = undefined;
			this.observer = undefined;
			this.retire();
			return undefined;
		}
		return current.kind === 'supported'
			? current.snapshot
			: element
				? { elementId: element.id, text: current.text }
				: undefined;
	}
	format(snapshot: InlineTextEditSnapshot): boolean {
		const result = this.controller?.format(snapshot);
		if (result?.kind !== 'supported') {
			return false;
		}
		this.observer?.expect(snapshot);
		return true;
	}
	end(): void {
		this.controller?.dispose();
		this.controller = undefined;
		this.observer = undefined;
		this.retire();
	}
}
