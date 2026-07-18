/**
 * ribbon-home-section.component.ts: the Home ribbon tab (Clipboard, Slides, Font
 * and Paragraph groups). Split out of {@link RibbonComponent}; behaviour and
 * markup are unchanged. Font/Paragraph controls are the shared
 * {@link RibbonFontControlsComponent} / {@link RibbonParagraphControlsComponent}.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
	LucideClipboardPaste,
	LucideCopy,
	LucidePaintbrush,
	LucidePlus,
	LucideScissors,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { RibbonEditingSectionComponent } from './ribbon-editing-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';

@Component({
	selector: 'pptx-ribbon-home-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		NgClass,
		TranslatePipe,
		LucidePlus,
		LucideClipboardPaste,
		LucideCopy,
		LucidePaintbrush,
		LucideScissors,
		RibbonFontControlsComponent,
		RibbonParagraphControlsComponent,
		RibbonEditingSectionComponent,
	],
	template: `
		<!-- Clipboard -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<!-- Icon-only clipboard buttons with title tooltips, matching React's HomeSection. -->
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.paste' | translate"
					[attr.aria-label]="'pptx.arrange.paste' | translate"
					(click)="paste()"
				>
					<svg lucideClipboardPaste class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.cut' | translate"
					[attr.aria-label]="'pptx.arrange.cut' | translate"
					[disabled]="!hasSel()"
					(click)="cut()"
				>
					<svg lucideScissors class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.copy' | translate"
					[attr.aria-label]="'pptx.arrange.copy' | translate"
					[disabled]="!hasSel()"
					(click)="copy()"
				>
					<svg lucideCopy class="h-4 w-4"></svg>
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
				>
					<svg lucidePaintbrush class="h-4 w-4"></svg>
				</button>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.clipboard' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Slides -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb gap-1.5"
					[title]="'pptx.ribbon.newSlide' | translate"
					(click)="editor.addSlide(slideIndex())"
				>
					<svg lucidePlus class="h-4 w-4"></svg> {{ 'pptx.ribbon.slide' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[title]="'pptx.ribbon.duplicateSlide' | translate"
					(click)="editor.duplicateSlide(slideIndex())"
				>
					{{ 'pptx.arrange.duplicate' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.master.layout' | translate"
					(click)="applyLayout.emit('blank')"
				>
					{{ 'pptx.master.layout' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-gb whitespace-nowrap"
					[title]="'pptx.sections.resetSlideTitle' | translate"
					(click)="resetSlide.emit()"
				>
					{{ 'pptx.sections.resetSlideTitle' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.sections.sectionButtonLabel' | translate"
					(click)="editor.addSection(slideIndex())"
				>
					{{ 'pptx.sections.sectionButtonLabel' | translate }}
				</button>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.sections.slides' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Font -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="flex items-center gap-1">
				<pptx-ribbon-font-controls
					[slideIndex]="slideIndex()"
					[selectedElement]="selectedElement()"
				/>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.font' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Paragraph -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="flex items-center gap-1">
				<pptx-ribbon-paragraph-controls
					[slideIndex]="slideIndex()"
					[selectedElement]="selectedElement()"
				/>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.paragraph' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Editing -->
		<div class="flex flex-col items-center gap-0.5">
			<pptx-ribbon-editing-section
				(toggleFindReplace)="findReplace.emit()"
				(selectAll)="onSelectAll()"
			/>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.shortcuts.group.editing' | translate }}
			</span>
		</div>
	`,
})
export class RibbonHomeSectionComponent {
	protected readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);

	readonly toggleFormatPainter = output<void>();
	readonly findReplace = output<void>();
	readonly applyLayout = output<string>();
	readonly resetSlide = output<void>();

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	protected copy(): void {
		this.editor.copySelected(this.slideIndex());
	}
	protected cut(): void {
		this.editor.cutSelected(this.slideIndex());
	}
	protected paste(): void {
		this.editor.paste(this.slideIndex());
	}
	protected onSelectAll(): void {
		this.editor.selectAll(this.slideIndex());
	}
}
