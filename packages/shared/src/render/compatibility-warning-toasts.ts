/**
 * compatibility-warning-toasts.ts: turn `handler.getCompatibilityWarnings()`
 * output into the toast list a binding should show.
 *
 * Core's `PptxCompatibilityService` (and a handful of save-path modules that
 * report through it) already flags every markup pattern it silently drops or
 * approximates: unmodelled OOXML it round-trips only via `rawXml`, an
 * external image reference that can't be embedded, signatures stripped on
 * save, a chart's embedded workbook it couldn't write back to, and so on. No
 * binding read `getCompatibilityWarnings()` at all, so an author saving a
 * deck that quietly lost fidelity had no way to know from the UI.
 *
 * This module is deliberately just a lookup: it does not decide WHEN to call
 * `getCompatibilityWarnings()` (after load, after save, ...), only how to
 * turn whatever it returns into toast descriptors with translated copy.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */

/** The `PptxCompatibilityWarning` fields this module reads. Declared structurally. */
export interface CompatibilityWarningSource {
	readonly code: string;
	readonly severity: 'info' | 'warning';
	readonly slideId?: string;
	readonly elementId?: string;
}

export interface CompatibilityWarningToast {
	/** Stable per-code id, since toasts are deduped by code (see module docs). */
	readonly id: string;
	readonly code: string;
	readonly severity: 'info' | 'warning';
	readonly messageKey: string;
	/** `{{code}}` for the generic fallback key; `undefined` for a mapped code. */
	readonly params?: Readonly<Record<string, string>>;
}

/**
 * Every `PptxCompatibilityWarning.code` core's compatibility reporter and
 * save-path modules currently emit (grepped across
 * `packages/core/src/core/services/PptxCompatibilityService.ts`,
 * `compatibility-alternate-content.ts`, and every `reportWarning(...)` call
 * site), mapped to its i18n key. A code not in this table falls back to
 * {@link GENERIC_MESSAGE_KEY} with the raw code as a `{{code}}` param, so a
 * future warning code degrades to a readable (if untranslated) toast instead
 * of being silently dropped.
 */
const CODE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
	UNMODELLED_PRESENTATION_MARKUP: 'pptx.compatibility.unmodelledPresentationMarkup',
	UNMODELLED_SLIDE_MARKUP: 'pptx.compatibility.unmodelledSlideMarkup',
	UNMODELLED_SHAPE_PROPERTY: 'pptx.compatibility.unmodelledShapeProperty',
	UNMODELLED_TEXT_BODY_MARKUP: 'pptx.compatibility.unmodelledTextBodyMarkup',
	UNMODELLED_BLIP_FILL_MARKUP: 'pptx.compatibility.unmodelledBlipFillMarkup',
	UNMODELLED_IMAGE_EFFECT: 'pptx.compatibility.unmodelledImageEffect',
	EXTERNAL_IMAGE_REFERENCE: 'pptx.compatibility.externalImageReference',
	SLIDE_SYNCHRONIZATION_METADATA: 'pptx.compatibility.slideSynchronizationMetadata',
	UNSUPPORTED_ALTERNATE_CONTENT_CHOICE: 'pptx.compatibility.unsupportedAlternateContentChoice',
	'group-depth-exceeded': 'pptx.compatibility.groupDepthExceeded',
	SAVE_NOTES_RELATIONSHIP_MISSING: 'pptx.compatibility.saveNotesRelationshipMissing',
	SAVE_NOTES_PART_MISSING: 'pptx.compatibility.saveNotesPartMissing',
	SAVE_NOTES_UPDATE_SKIPPED: 'pptx.compatibility.saveNotesUpdateSkipped',
	CHART_EXTERNAL_DATA_WRITEBACK_UNSUPPORTED:
		'pptx.compatibility.chartExternalDataWritebackUnsupported',
	CHART_EMBEDDED_WORKBOOK_MISSING: 'pptx.compatibility.chartEmbeddedWorkbookMissing',
	CHART_EMBEDDED_WORKBOOK_UNREADABLE: 'pptx.compatibility.chartEmbeddedWorkbookUnreadable',
	CHART_EMBEDDED_WORKBOOK_PARTIAL_WRITEBACK:
		'pptx.compatibility.chartEmbeddedWorkbookPartialWriteback',
	SAVE_IMAGE_PAYLOAD_UNSUPPORTED: 'pptx.compatibility.saveImagePayloadUnsupported',
	SAVE_MEDIA_PAYLOAD_UNSUPPORTED: 'pptx.compatibility.saveMediaPayloadUnsupported',
	SAVE_ELEMENT_SKIPPED: 'pptx.compatibility.saveElementSkipped',
	SAVE_SIGNATURES_STRIPPED: 'pptx.compatibility.saveSignaturesStripped',
	SAVE_GROUP_CHILD_SKIPPED: 'pptx.compatibility.saveGroupChildSkipped',
	SAVE_ANIMATION_SOUND_PAYLOAD_UNSUPPORTED:
		'pptx.compatibility.saveAnimationSoundPayloadUnsupported',
	SAVE_BACKGROUND_IMAGE_UNSUPPORTED: 'pptx.compatibility.saveBackgroundImageUnsupported',
	SHAPE_ID_DEDUPLICATED: 'pptx.compatibility.shapeIdDeduplicated',
	SAVE_TRANSITION_SOUND_PAYLOAD_UNSUPPORTED:
		'pptx.compatibility.saveTransitionSoundPayloadUnsupported',
	DIAGRAM_RELATIONSHIP_IDS_INCOMPLETE: 'pptx.compatibility.diagramRelationshipIdsIncomplete',
	EXPORT_BACKEND_UNAVAILABLE: 'pptx.compatibility.exportBackendUnavailable',
};

/** Fallback key for a warning code with no entry in {@link CODE_MESSAGE_KEYS}. */
const GENERIC_MESSAGE_KEY = 'pptx.compatibility.generic';

/**
 * Map `getCompatibilityWarnings()` output to the toast list a binding should
 * show, deduped by code.
 *
 * Core already dedupes exact repeats (same code + scope + ids), but a save
 * touching fifty images with the same unsupported payload still reports
 * fifty warnings sharing one code; surfacing fifty identical toasts would be
 * worse than surfacing none, so this collapses to one toast per code. The
 * FIRST warning for a code decides that toast's severity, matching how a
 * user reads a deduped list: the earliest (usually most encompassing) case.
 */
export function compatibilityWarningToasts(
	warnings: readonly CompatibilityWarningSource[],
): CompatibilityWarningToast[] {
	const seen = new Map<string, CompatibilityWarningToast>();
	for (const warning of warnings) {
		if (seen.has(warning.code)) {
			continue;
		}
		const messageKey = CODE_MESSAGE_KEYS[warning.code];
		seen.set(warning.code, {
			id: warning.code,
			code: warning.code,
			severity: warning.severity,
			messageKey: messageKey ?? GENERIC_MESSAGE_KEY,
			params: messageKey ? undefined : { code: warning.code },
		});
	}
	return [...seen.values()];
}
