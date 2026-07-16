/**
 * ribbon-file-section.component.ts: the File ribbon tab (Open/Save, PNG/PDF/GIF/
 * Video export group, Print/Properties/Signatures/Replace, Protect/Embed fonts/
 * Version history). Split out of {@link RibbonComponent}; behaviour and markup
 * are unchanged. All actions are `output()` events the parent already handles.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-ribbon-file-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		<button
			type="button"
			class="pptx-rb-pill"
			(click)="openFile.emit()"
			[title]="'pptx.ribbon.openAnotherPresentation' | translate"
		>
			{{ 'pptx.ribbon.open' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="save.emit()"
			[attr.aria-label]="'pptx.file.saveAsPptx' | translate"
			[title]="'pptx.ribbon.saveAsPptx' | translate"
		>
			{{ 'pptx.toolbar.save' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="slideCount() === 0"
			(click)="savePpsx.emit()"
			[title]="'pptx.file.saveAsPpsxTooltip' | translate"
		>
			{{ 'pptx.file.saveAsPpsx' | translate }}
		</button>
		@if (hasMacros()) {
			<button
				type="button"
				class="pptx-rb-pill"
				[disabled]="slideCount() === 0"
				(click)="savePptm.emit()"
				[title]="'pptx.file.saveAsPptmTooltip' | translate"
			>
				{{ 'pptx.file.saveAsPptm' | translate }}
			</button>
		}
		<span class="pptx-rb-sep"></span>
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="exporting() || slideCount() === 0"
				(click)="exportPng.emit()"
				[title]="'pptx.ribbon.exportCurrentSlidePng' | translate"
			>
				PNG
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="exporting() || slideCount() === 0"
				(click)="exportPdf.emit()"
				[title]="'pptx.ribbon.exportDeckPdf' | translate"
			>
				{{ exporting() ? ('pptx.ribbon.exporting' | translate) : 'PDF' }}
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="exporting() || slideCount() === 0"
				(click)="exportGif.emit()"
				[title]="'pptx.ribbon.exportGifTitle' | translate"
			>
				GIF
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="exporting() || slideCount() === 0"
				(click)="exportVideo.emit()"
				[title]="'pptx.ribbon.exportWebmVideo' | translate"
			>
				{{ 'pptx.file.video' | translate }}
			</button>
		</div>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="exporting() || slideCount() === 0"
			(click)="copySlideAsImage.emit()"
			[title]="'pptx.file.copyImageTooltip' | translate"
		>
			{{ 'pptx.file.copyImage' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<button type="button" class="pptx-rb-pill" (click)="print.emit()">
			{{ 'pptx.print.printButton' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="info.emit()">
			{{ 'pptx.ribbon.properties' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="signatures.emit()">
			{{ 'pptx.ribbon.signatures' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="replace.emit()">
			{{ 'pptx.ribbon.replace' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.protectWithPassword' | translate"
			(click)="openPassword.emit()"
		>
			{{ 'pptx.ribbon.protect' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.manageEmbeddedFonts' | translate"
			(click)="openFontEmbedding.emit()"
		>
			{{ 'pptx.ribbon.embedFonts' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.browseSavedVersions' | translate"
			(click)="openVersionHistory.emit()"
		>
			{{ 'pptx.ribbon.versionHistory' | translate }}
		</button>
	`,
})
export class RibbonFileSectionComponent {
	readonly slideCount = input<number>(0);
	readonly exporting = input<boolean>(false);
	readonly hasMacros = input<boolean>(false);

	readonly openFile = output<void>();
	readonly save = output<void>();
	readonly savePpsx = output<void>();
	readonly savePptm = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly copySlideAsImage = output<void>();
	readonly print = output<void>();
	readonly info = output<void>();
	readonly signatures = output<void>();
	readonly replace = output<void>();
	readonly openPassword = output<void>();
	readonly openFontEmbedding = output<void>();
	readonly openVersionHistory = output<void>();
}
