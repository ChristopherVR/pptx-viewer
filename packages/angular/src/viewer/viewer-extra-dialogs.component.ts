/**
 * viewer-extra-dialogs.component.ts: Single host for the secondary viewer
 * dialogs / side panels (equation editor, set-up-slide-show, password
 * protection, encrypted-file notice, compare, font embedding, version history,
 * shortcut cheat-sheet, keep-annotations, signature-stripped warning).
 *
 * Selector: `pptx-viewer-extra-dialogs`
 *
 * Mirrors the React `ViewerDialogGroup` / `ViewerOverlays` aggregators: it keeps
 * the large `PowerPointViewerComponent` orchestrator from growing one tag +
 * handler per dialog. Open-state lives in the shared {@link ViewerDialogsService}
 * (provided on the viewer host) so the ribbon can open a dialog without knowing
 * how it renders. This container injects the viewer-scoped editor / loader /
 * font services directly and performs the per-dialog wiring internally.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';

import { ComparePanelComponent } from './compare-panel.component';
import { EditorStateService } from './editor-state.service';
import { EmbeddedFontsService } from './embedded-fonts.service';
import { EncryptedFileDialogComponent } from './encrypted-file-dialog.component';
import { EquationEditorDialogComponent } from './equation-editor-dialog.component';
import { FontEmbeddingPanelComponent } from './font-embedding-panel.component';
import { KeepAnnotationsDialogComponent } from './keep-annotations-dialog.component';
import { LoadContentService } from './load-content.service';
import { PasswordProtectionDialogComponent } from './password-protection-dialog.component';
import type { SlideAnnotationMap } from './presentation-annotations-helpers';
import { SetUpSlideShowDialogComponent } from './set-up-slide-show-dialog.component';
import { ShortcutPanelComponent } from './shortcut-panel.component';
import { SignatureStrippedDialogComponent } from './signature-stripped-dialog.component';
import { VersionHistoryPanelComponent } from './version-history-panel.component';
import { ViewerCompareService } from './viewer-compare.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import {
	annotationMapToInkInserts,
	buildEquationElement,
	buildEquationSegment,
	collectUsedFontFamilies,
	countAnnotationStrokes,
} from './viewer-extra-dialogs-helpers';

@Component({
	selector: 'pptx-viewer-extra-dialogs',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		EquationEditorDialogComponent,
		SetUpSlideShowDialogComponent,
		PasswordProtectionDialogComponent,
		EncryptedFileDialogComponent,
		ComparePanelComponent,
		FontEmbeddingPanelComponent,
		VersionHistoryPanelComponent,
		ShortcutPanelComponent,
		KeepAnnotationsDialogComponent,
		SignatureStrippedDialogComponent,
	],
	template: `
		<pptx-equation-editor-dialog
			[open]="svc.showEquation()"
			[existingOmml]="svc.editingEquationOmml()"
			(insert)="onEquationInsert($event)"
			(close)="svc.showEquation.set(false)"
		/>

		<pptx-set-up-slide-show-dialog
			[open]="svc.showSetUpSlideShow()"
			[properties]="svc.presentationProperties()"
			[customShows]="customShows()"
			[slideCount]="editor.slides().length"
			(save)="onSlideShowSave($event)"
			(close)="svc.showSetUpSlideShow.set(false)"
		/>

		<pptx-password-protection-dialog
			[open]="svc.showPassword()"
			[isCurrentlyProtected]="svc.isPasswordProtected()"
			(setPassword)="onSetPassword($event)"
			(removePassword)="onRemovePassword()"
			(close)="svc.showPassword.set(false)"
		/>

		<pptx-encrypted-file-dialog
			[open]="svc.showEncrypted()"
			(close)="svc.showEncrypted.set(false)"
		/>

		<pptx-compare-panel
			[open]="svc.showCompare()"
			[compareResult]="svc.compareResult()"
			[canvasSize]="loader.canvasSize()"
			[mediaDataUrls]="mediaRecord()"
			(acceptSlide)="compare.acceptSlide($event)"
			(rejectSlide)="compare.rejectSlide($event)"
			(acceptAll)="compare.acceptAll()"
			(close)="svc.showCompare.set(false)"
		/>

		<pptx-font-embedding-panel
			[open]="svc.showFontEmbedding()"
			[embedFontsEnabled]="svc.embedFontsEnabled()"
			[usedFontFamilies]="usedFontFamilies()"
			[embeddedFonts]="embeddedFamilies()"
			(toggleEmbedFonts)="svc.embedFontsEnabled.set($event)"
			(close)="svc.showFontEmbedding.set(false)"
		/>

		<pptx-version-history-panel
			[open]="svc.showVersionHistory()"
			[filePath]="filePath()"
			(restore)="restoreContent.emit($event)"
			(close)="svc.showVersionHistory.set(false)"
		/>

		<pptx-shortcut-panel [open]="svc.showShortcuts()" (close)="svc.showShortcuts.set(false)" />

		<pptx-keep-annotations-dialog
			[open]="svc.showKeepAnnotations()"
			[annotationCount]="svc.keepAnnotationCount()"
			[slideCount]="svc.keepSlideCount()"
			(keep)="onKeepAnnotations()"
			(discard)="onDiscardAnnotations()"
		/>

		<pptx-signature-stripped-dialog
			[open]="svc.showSignatureStripped()"
			[signatureCount]="loader.digitalSignatureCount()"
			(confirm)="svc.showSignatureStripped.set(false)"
			(cancel)="svc.showSignatureStripped.set(false)"
		/>
	`,
})
export class ViewerExtraDialogsComponent {
	/** Active slide index (equation inserts land on this slide). */
	readonly activeSlideIndex = input<number>(0);
	/** Id of the single selected element (target for an equation edit). */
	readonly selectedElementId = input<string | null>(null);
	/** Host file path used by the version-history panel to key IndexedDB. */
	readonly filePath = input<string | undefined>(undefined);
	/** Custom shows offered in the set-up-slide-show "show slides" fieldset. */
	readonly customShows = input<PptxCustomShow[]>([]);

	/** Fired with a restored `.pptx` version's bytes; the host swaps the deck. */
	readonly restoreContent = output<Uint8Array>();

	protected readonly svc = inject(ViewerDialogsService);
	protected readonly compare = inject(ViewerCompareService);
	protected readonly editor = inject(EditorStateService);
	protected readonly loader = inject(LoadContentService);
	private readonly fonts = inject(EmbeddedFontsService);

	/** Distinct font families used across the editable deck. */
	protected readonly usedFontFamilies = computed(() =>
		collectUsedFontFamilies(this.editor.slides()),
	);
	/** Families backed by an embedded @font-face rule. */
	protected readonly embeddedFamilies = computed(() => this.fonts.fontFamilies());
	/** Media data-URL map as a plain record for the compare thumbnails. */
	protected readonly mediaRecord = computed<Record<string, string>>(() =>
		Object.fromEntries(this.loader.mediaDataUrls()),
	);

	/** Guards the one-shot signature-stripped warning on first edit. */
	private signatureWarningShown = false;

	/** Presentation-mode ink pending the keep/discard decision. */
	private readonly pendingAnnotations = signal<SlideAnnotationMap | null>(null);

	constructor() {
		// Surface the signature-stripped warning the first time a signed deck is
		// edited (mirrors React's first-edit-of-signed-document prompt).
		effect(() => {
			const dirty = this.editor.dirty();
			if (
				dirty &&
				!this.signatureWarningShown &&
				this.loader.hasDigitalSignatures() &&
				this.loader.digitalSignatureCount() > 0
			) {
				this.signatureWarningShown = true;
				this.svc.showSignatureStripped.set(true);
			}
			if (!dirty) {
				this.signatureWarningShown = false;
			}
		});
	}

	/**
	 * Offer the keep/discard prompt for ink drawn during a presentation.
	 * Called by the viewer when the presentation overlay exits with annotations.
	 */
	promptKeepAnnotations(map: SlideAnnotationMap): void {
		const strokeCount = countAnnotationStrokes(map);
		if (strokeCount === 0) {
			return;
		}
		this.pendingAnnotations.set(map);
		this.svc.keepAnnotationCount.set(strokeCount);
		this.svc.keepSlideCount.set(map.size);
		this.svc.showKeepAnnotations.set(true);
	}

	/** Persist the pending presentation ink as `ink` elements on their slides. */
	onKeepAnnotations(): void {
		const map = this.pendingAnnotations();
		if (map) {
			for (const { slideIndex, ink } of annotationMapToInkInserts(map)) {
				this.editor.addElement(slideIndex, ink);
			}
		}
		this.pendingAnnotations.set(null);
		this.svc.showKeepAnnotations.set(false);
	}

	/** Drop the pending presentation ink. */
	onDiscardAnnotations(): void {
		this.pendingAnnotations.set(null);
		this.svc.showKeepAnnotations.set(false);
	}

	/** Insert a new equation element, or update the one currently being edited. */
	onEquationInsert(omml: Record<string, unknown>): void {
		const editingId = this.svc.editingEquationElementId();
		if (editingId) {
			this.editor.updateElement(this.activeSlideIndex(), editingId, {
				textSegments: [buildEquationSegment(omml)],
			});
		} else {
			this.editor.addElement(this.activeSlideIndex(), buildEquationElement(omml));
		}
		this.svc.showEquation.set(false);
	}

	/** Persist the slide-show settings for this session. */
	onSlideShowSave(properties: PptxPresentationProperties): void {
		this.svc.presentationProperties.set(properties);
		this.svc.showSetUpSlideShow.set(false);
	}

	/** Record a save password (applied by the save pipeline). */
	onSetPassword(password: string): void {
		this.svc.presentationPassword.set(password);
		this.svc.isPasswordProtected.set(true);
		this.svc.showPassword.set(false);
	}

	/** Clear any save password. */
	onRemovePassword(): void {
		this.svc.presentationPassword.set(null);
		this.svc.isPasswordProtected.set(false);
		this.svc.showPassword.set(false);
	}
}
