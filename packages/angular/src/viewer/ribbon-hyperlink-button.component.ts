/**
 * ribbon-hyperlink-button.component.ts: Insert > Link.
 *
 * Its own component rather than another block inside
 * {@link RibbonInsertSectionComponent}, which is already at this repo's 300-LOC
 * budget. Angular shipped the hyperlink editor (`HyperlinkDialogComponent`) and
 * the context-menu entry that opens it, but never the ribbon entry point
 * PowerPoint puts on Insert, so the command was reachable only by right-click.
 *
 * Gated on a selection because a link always attaches to something.
 */
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { LucideLink } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-hyperlink-button',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, LucideLink],
	template: `
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!editor.hasSelection()"
			[title]="'pptx.hyperlinkDialog.title' | translate"
			(click)="openHyperlink.emit()"
		>
			<svg lucideLink class="h-4 w-4"></svg> {{ 'pptx.hyperlinkDialog.title' | translate }}
		</button>
	`,
})
export class RibbonHyperlinkButtonComponent {
	protected readonly editor = inject(EditorStateService);

	/** The host opens the hyperlink edit dialog for the current selection. */
	readonly openHyperlink = output<void>();
}
