/**
 * paste-options-toolbar.component.ts: the small icon-strip PowerPoint anchors
 * to the bottom-right corner of a just-pasted element, offering the same four
 * formats as the Paste Special dialog as a one-click follow-up. Dismissed by
 * any subsequent pointerdown or keydown, same as the element context menu.
 *
 * Selector: `pptx-paste-options-toolbar`
 *
 * Angular adapter around the shared `pptx-ui-paste-options`: this measures the
 * pasted element and the element renders, positions and dismisses the strip.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { findCanvasElementNode } from '../internal/shared';
import type {
	PasteOptionsRequestEvent,
	PasteOptionsViewState,
	PasteSpecialFormat,
} from '../internal/shared';
import { translationsSignal } from './translations-signal';

@Component({
	selector: 'pptx-paste-options-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { class: 'contents' },
	template: `
		@if (elementId() && rect()) {
			<pptx-ui-paste-options
				[state]="view()"
				(paste-options-request)="onRequest($event)"
				(paste-options-dismiss)="dismiss.emit()"
			/>
		}
	`,
})
export class PasteOptionsToolbarComponent {
	/** The just-pasted element's id, or null when the toolbar should be hidden. */
	readonly elementId = input<string | null>(null);

	readonly choose = output<PasteSpecialFormat>();
	readonly dismiss = output<void>();

	protected readonly rect = signal<{ left: number; top: number } | null>(null);

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	protected readonly view = computed<PasteOptionsViewState>(() => {
		this.translations();
		const rect = this.rect();
		return {
			left: rect?.left ?? 0,
			top: rect?.top ?? 0,
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	constructor() {
		effect((onCleanup) => {
			const id = this.elementId();
			this.rect.set(null);
			if (!id) {
				return;
			}
			// One frame for the pasted element to mount before measuring it.
			const frame = requestAnimationFrame(() => {
				const box = findCanvasElementNode(document, id, {
					canvasOnly: true,
				})?.getBoundingClientRect();
				this.rect.set(box ? { left: box.right, top: box.bottom } : null);
			});
			onCleanup(() => cancelAnimationFrame(frame));
		});
	}

	protected onRequest(event: Event): void {
		this.choose.emit((event as PasteOptionsRequestEvent).detail.format);
	}
}
