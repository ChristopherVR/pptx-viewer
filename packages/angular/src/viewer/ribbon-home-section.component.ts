/**
 * ribbon-home-section.component.ts: the Home ribbon tab (Clipboard, Slides, Font
 * and Paragraph groups). Split out of {@link RibbonComponent}; behaviour and
 * markup are unchanged. Font/Paragraph controls are the shared
 * {@link RibbonFontControlsComponent} / {@link RibbonParagraphControlsComponent}.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
	LucideChevronDown,
	LucideClipboardPaste,
	LucideCopy,
	LucideFolderPlus,
	LucideLayoutGrid,
	LucidePaintbrush,
	LucidePlus,
	LucideRotateCcw,
	LucideScissors,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { RibbonEditingSectionComponent } from './ribbon-editing-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { layoutOptionsFrom } from './ribbon-layout-options';
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
		LucideChevronDown,
		LucideClipboardPaste,
		LucideCopy,
		LucideFolderPlus,
		LucideLayoutGrid,
		LucidePaintbrush,
		LucideRotateCcw,
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
					[disabled]="!editor.hasClipboard() || !canEdit()"
					(click)="paste()"
				>
					<svg lucideClipboardPaste class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.cut' | translate"
					[attr.aria-label]="'pptx.arrange.cut' | translate"
					[disabled]="!canEdit() || !selectedElement()"
					(click)="cut()"
				>
					<svg lucideScissors class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.arrange.copy' | translate"
					[attr.aria-label]="'pptx.arrange.copy' | translate"
					[disabled]="!selectedElement()"
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
			<div class="flex items-center gap-1">
				<!--
					New Slide is a split button (React SlidesGroup parity): the face adds
					a blank slide, the chevron picks the layout the new slide inherits
					from. The chevron sits OUTSIDE the pptx-rb-grp wrapper because that
					class is overflow-hidden, which would clip the menu, and the menu
					itself only renders for a deck that actually has layouts.
				-->
				<div class="pptx-rb-grp">
					<button
						type="button"
						class="pptx-rb-gl gap-1.5 whitespace-nowrap"
						[title]="'pptx.home.newSlide' | translate"
						(click)="editor.addSlide(slideIndex())"
					>
						<svg lucidePlus class="h-4 w-4"></svg> {{ 'pptx.home.newSlide' | translate }}
					</button>
				</div>
				@if (layoutOptions().length > 0) {
					<div class="group relative">
						<button
							type="button"
							class="pptx-rb-pill px-1.5"
							[disabled]="!canEdit()"
							[title]="'pptx.home.chooseLayout' | translate"
							[attr.aria-label]="'pptx.home.chooseLayout' | translate"
						>
							<svg lucideChevronDown class="h-3 w-3"></svg>
						</button>
						<div
							class="absolute left-0 top-full z-50 hidden max-h-60 w-48 overflow-y-auto pt-1 group-hover:block"
						>
							<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
								@for (option of layoutOptions(); track option.path) {
									<button
										type="button"
										class="flex w-full items-center px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
										[disabled]="!canEdit()"
										(click)="editor.addSlide(slideIndex(), option.path)"
									>
										{{ option.name }}
									</button>
								}
							</div>
						</div>
					</div>
				}
				<div class="pptx-rb-grp">
					<button
						type="button"
						class="pptx-rb-gb whitespace-nowrap"
						[title]="'pptx.master.layout' | translate"
						(click)="applyLayout.emit('blank')"
					>
						<svg lucideLayoutGrid class="h-4 w-4"></svg> {{ 'pptx.master.layout' | translate }}
					</button>
					<button
						type="button"
						class="pptx-rb-gb whitespace-nowrap"
						[title]="'pptx.sections.resetSlideTitle' | translate"
						(click)="resetSlide.emit()"
					>
						<svg lucideRotateCcw class="h-4 w-4"></svg> {{ 'pptx.animations.reset' | translate }}
					</button>
					<button
						type="button"
						class="pptx-rb-gl whitespace-nowrap"
						[title]="'pptx.sections.addSection' | translate"
						(click)="editor.addSection(slideIndex())"
					>
						<svg lucideFolderPlus class="h-4 w-4"></svg>
						{{ 'pptx.sections.sectionButtonLabel' | translate }}
					</button>
				</div>
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
	private readonly loader = inject(LoadContentService);

	/** Layouts offered by the New Slide split button (empty for a layout-less deck). */
	protected readonly layoutOptions = computed(() => layoutOptionsFrom(this.loader.slideMasters()));

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);

	readonly toggleFormatPainter = output<void>();
	readonly findReplace = output<void>();
	readonly applyLayout = output<string>();
	readonly resetSlide = output<void>();

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
