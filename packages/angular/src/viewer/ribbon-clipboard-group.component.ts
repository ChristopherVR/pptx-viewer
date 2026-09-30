/**
 * ribbon-clipboard-group.component.ts: the Home tab's Clipboard group (Paste,
 * Cut, Copy, Format Painter), split out of {@link RibbonHomeSectionComponent}
 * to keep that file near the repo's 300-LOC budget. Icon-only buttons with
 * title tooltips, matching React's HomeSection; clipboard commands go straight
 * through {@link EditorStateService}.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { RibbonIconDirective } from './ribbon-icon.directive';

@Component({
	selector: 'pptx-ribbon-clipboard-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RibbonIconDirective, NgClass, TranslatePipe],
	template: `
		<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.clipboard">
			<div class="pptx-rb-grp">
				<!-- Icon-only clipboard buttons with title tooltips, matching React's HomeSection. -->
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.paste' | translate"
					[attr.aria-label]="'pptx.arrange.paste' | translate"
					[disabled]="!editor.hasClipboard() || !canEdit()"
					(click)="paste()"
					data-ribbon-control="home.clipboard.paste"
				>
					<svg pptxRibbonIcon="home.clipboard.paste"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.cut' | translate"
					[attr.aria-label]="'pptx.arrange.cut' | translate"
					[disabled]="!canEdit() || !selectedElement()"
					(click)="cut()"
					data-ribbon-control="home.clipboard.cut"
				>
					<svg pptxRibbonIcon="home.clipboard.cut"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.copy' | translate"
					[attr.aria-label]="'pptx.arrange.copy' | translate"
					[disabled]="!selectedElement()"
					(click)="copy()"
					data-ribbon-control="home.clipboard.copy"
				>
					<svg pptxRibbonIcon="home.clipboard.copy"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					data-testid="format-painter-toggle"
					[attr.data-active]="formatPainterActive() ? 'true' : 'false'"
					[ngClass]="formatPainterActive() ? 'bg-primary text-primary-foreground' : ''"
					[disabled]="!canActivateFormatPainter() && !formatPainterActive()"
					[title]="'pptx.arrange.formatPainter' | translate"
					[attr.aria-label]="'pptx.arrange.formatPainter' | translate"
					(click)="toggleFormatPainter.emit()"
					data-ribbon-control="home.clipboard.formatPainter"
				>
					<svg pptxRibbonIcon="home.clipboard.formatPainter"></svg>
				</button>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.clipboard' | translate }}
			</span>
		</div>
	`,
})
export class RibbonClipboardGroupComponent {
	protected readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);

	readonly toggleFormatPainter = output<void>();

	protected copy(): void {
		this.editor.copySelected(this.slideIndex());
	}
	protected cut(): void {
		this.editor.cutSelected(this.slideIndex());
	}
	protected paste(): void {
		this.editor.paste(this.slideIndex());
	}
}
