/**
 * viewer-dialogs.service.ts: Viewer-scoped open-state + light state for the
 * secondary dialogs and side panels (equation editor, set-up-slide-show,
 * password protection, encrypted-file notice, compare, font embedding, version
 * history, shortcut cheat-sheet, keep-annotations, signature-stripped warning).
 *
 * Mirrors the React `useViewerDialogs` hook: the flags live in one place so the
 * ribbon can open a dialog without knowing how it is rendered, and the
 * {@link ViewerExtraDialogsComponent} container can render every dialog from a
 * single host tag. Keeping this out of `PowerPointViewerComponent` stops that
 * already-large orchestrator from growing for each new dialog.
 *
 * Provide it once on the viewer component (`providers: [ViewerDialogsService]`)
 * so the ribbon host and the dialog container share the same instance.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import type { PptxPresentationProperties } from 'pptx-viewer-core';

import { describeFontEmbedding } from '../internal/shared';
import type { CompareResult } from '../internal/shared';
import { LoadContentService } from './load-content.service';

@Injectable()
export class ViewerDialogsService {
	// ── Equation editor ────────────────────────────────────────────────────
	/** Equation editor dialog visibility. */
	readonly showEquation = signal(false);
	/** OMML of the equation being edited (null when inserting a fresh one). */
	readonly editingEquationOmml = signal<Record<string, unknown> | null>(null);
	/** Id of the element whose equation is being edited (null when inserting). */
	readonly editingEquationElementId = signal<string | null>(null);

	// ── Set Up Slide Show ──────────────────────────────────────────────────
	/** Set-up-slide-show dialog visibility. */
	readonly showSetUpSlideShow = signal(false);
	/** In-session presentation properties (advance mode, loop, subtitles, ...). */
	readonly presentationProperties = signal<PptxPresentationProperties>({});

	// ── Password protection ────────────────────────────────────────────────
	/** Password-protection dialog visibility. */
	readonly showPassword = signal(false);
	/** Whether a save password is currently set. */
	readonly isPasswordProtected = signal(false);
	/** The password applied on the next save (null when none). */
	readonly presentationPassword = signal<string | null>(null);

	// ── Encrypted-file notice ──────────────────────────────────────────────
	/** Encrypted-file information dialog visibility. */
	readonly showEncrypted = signal(false);

	// ── Compare presentations ──────────────────────────────────────────────
	/** Compare side panel visibility. */
	readonly showCompare = signal(false);
	/** Slide-diff result shown in the compare panel (null when none loaded). */
	readonly compareResult = signal<CompareResult | null>(null);

	// ── Font embedding ─────────────────────────────────────────────────────
	/** Font-embedding panel visibility. */
	readonly showFontEmbedding = signal(false);
	/**
	 * The deck this viewer loaded, when one is provided alongside this service
	 * (it always is on the viewer host). Optional so the isolated service tests
	 * and stubbed injectors keep working.
	 */
	private readonly loader = inject(LoadContentService, { optional: true });
	/**
	 * Whether the save keeps the deck's embedded font data.
	 *
	 * Deliberately the loader's OWN signal rather than a copy: the flag is read
	 * by `LoadContentService.saveSlides`, and it is seeded there from the loaded
	 * deck, so a second source of truth here would let the panel and the save
	 * path disagree. Previously this was a standalone `signal(false)` that
	 * nothing ever read; wiring THAT to save would have stripped the embedded
	 * fonts of every deck that had them.
	 */
	readonly embedFontsEnabled = this.loader?.embedFonts ?? signal(true);
	/**
	 * Whether the toggle accepts input, plus the reason when it does not: the
	 * viewer can keep or strip embedded font data, but cannot manufacture it for
	 * a deck that embeds nothing.
	 */
	readonly fontEmbedding = computed(
		() => this.loader?.fontEmbedding() ?? describeFontEmbedding([]),
	);

	// ── Version history ────────────────────────────────────────────────────
	/** Version-history side panel visibility. */
	readonly showVersionHistory = signal(false);

	// ── Keyboard shortcut cheat-sheet ──────────────────────────────────────
	/** Keyboard-shortcuts help overlay visibility. */
	readonly showShortcuts = signal(false);
	/** Viewer/editor preferences dialog visibility. */
	readonly showSettings = signal(false);
	/** Presentation header/footer editor visibility. */
	readonly showHeaderFooter = signal(false);

	// ── Keep-annotations prompt ────────────────────────────────────────────
	/** Keep-annotations dialog visibility. */
	readonly showKeepAnnotations = signal(false);
	/** Total ink annotation stroke count carried into the prompt. */
	readonly keepAnnotationCount = signal(0);
	/** Number of slides that carry annotations. */
	readonly keepSlideCount = signal(0);

	// ── Signature-stripped warning ─────────────────────────────────────────
	/** Signature-stripped warning dialog visibility. */
	readonly showSignatureStripped = signal(false);

	/** Open the equation editor for a fresh insert. */
	openEquationInsert(): void {
		this.editingEquationOmml.set(null);
		this.editingEquationElementId.set(null);
		this.showEquation.set(true);
	}

	/** Open the equation editor to edit an existing element's equation. */
	openEquationEdit(elementId: string, omml: Record<string, unknown>): void {
		this.editingEquationElementId.set(elementId);
		this.editingEquationOmml.set(omml);
		this.showEquation.set(true);
	}
}
