/**
 * ribbon-clipboard-group.component.ts: the Home tab's Clipboard group. The
 * markup, icons, gating and styles come from the shared
 * `pptx-ui-ribbon-home-clipboard` element; this adapter reflects editor state
 * into it and routes its one `home-request` intent through
 * {@link EditorStateService}, which keeps clipboard history and persistence.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { clipboardHomeControls } from '../internal/shared';
import type { RibbonHomeRequestEvent } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-clipboard-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-home-clipboard [state]="view()" (home-request)="request($event)" />`,
})
export class RibbonClipboardGroupComponent {
	protected readonly editor = inject(EditorStateService);
	private readonly translation = inject(TranslateService, { optional: true });

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);

	readonly toggleFormatPainter = output<void>();

	protected view() {
		return {
			controls: clipboardHomeControls({
				editable: this.canEdit(),
				hasSelection: Boolean(this.selectedElement()),
				hasClipboard: this.editor.hasClipboard(),
				formatPainterActive: this.formatPainterActive(),
				canFormatPaint: this.canActivateFormatPainter(),
				showFormatPainter: true,
			}),
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}

	protected request(event: Event): void {
		const slide = this.slideIndex();
		switch ((event as RibbonHomeRequestEvent).detail.id) {
			case 'home.clipboard.paste':
				this.editor.paste(slide);
				break;
			case 'home.clipboard.cut':
				this.editor.cutSelected(slide);
				break;
			case 'home.clipboard.copy':
				this.editor.copySelected(slide);
				break;
			case 'home.clipboard.formatPainter':
				this.toggleFormatPainter.emit();
		}
	}
}
