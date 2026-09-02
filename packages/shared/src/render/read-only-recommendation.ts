/**
 * read-only-recommendation.ts: whether a loaded deck asks to be opened
 * read-only, and why.
 *
 * Core parses two independent signals a `.pptx` can carry for this:
 * - `p:modifyVerifier` in `presentation.xml`: a password hash written by
 *   PowerPoint's "Protect Presentation > Restrict Editing" / the legacy
 *   "Set Password to Modify" flow. Its presence means editing requires a
 *   password this viewer never asks for, so the deck should default to
 *   read-only.
 * - `docProps/custom.xml`'s well-known `_MarkAsFinal` custom property, which
 *   PowerPoint's "Mark as Final" writes. Unlike `modifyVerifier` this is not
 *   modelled as its own field (no reader-facing feature besides this one has
 *   needed it), so it is read out of the already-parsed `customProperties`
 *   list here rather than adding a core field for a single boolean.
 *
 * Both are recommendations, not enforcement: neither core nor this module
 * blocks a save, they only tell a binding what state to default a "read-only"
 * toggle to and what banner to show. Every binding surfaces it as the
 * read-only banner (editing stays locked until "Edit anyway"); before that a
 * deck opened this way was silently editable.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */

/** The `PptxData` fields this decision reads. Declared structurally. */
export interface ReadOnlyRecommendationSource {
	readonly modifyVerifier?: {
		readonly hashData?: string;
		readonly algorithmName?: string;
	};
	readonly customProperties?: ReadonlyArray<{
		readonly name: string;
		readonly value: string;
		readonly type?: string;
	}>;
}

export type ReadOnlyRecommendationKind = 'modifyVerifier' | 'markedFinal' | null;

export interface ReadOnlyRecommendation {
	readonly kind: ReadOnlyRecommendationKind;
	/** i18n key for the banner/toast a binding shows for this recommendation. */
	readonly messageKey: string;
	/** Whether a binding's "read-only" toggle should default to on. */
	readonly defaultReadOnly: boolean;
}

const NOT_RECOMMENDED: ReadOnlyRecommendation = {
	kind: null,
	messageKey: '',
	defaultReadOnly: false,
};

/** `docProps/custom.xml`'s well-known "Mark as Final" property name. */
const MARK_AS_FINAL_PROPERTY_NAME = '_MarkAsFinal';

/** Truthy values PowerPoint writes for a boolean-typed custom property. */
function isTruthyCustomPropertyValue(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function isMarkedAsFinal(
	customProperties: ReadOnlyRecommendationSource['customProperties'],
): boolean {
	if (!customProperties) {
		return false;
	}
	return customProperties.some(
		(property) =>
			property.name === MARK_AS_FINAL_PROPERTY_NAME && isTruthyCustomPropertyValue(property.value),
	);
}

/**
 * Whether a loaded deck recommends opening read-only, and why.
 *
 * `modifyVerifier` takes priority over "Mark as Final": a password-protected
 * deck cannot be saved back over the original without the password even if
 * the user dismisses the recommendation, while "Mark as Final" is purely
 * advisory (PowerPoint's own "Edit Anyway" button removes it), so the
 * stronger signal is the one a binding should lead with when a deck somehow
 * carries both.
 */
export function readOnlyRecommendation(
	data: ReadOnlyRecommendationSource | undefined,
): ReadOnlyRecommendation {
	if (!data) {
		return NOT_RECOMMENDED;
	}
	if (data.modifyVerifier && (data.modifyVerifier.hashData || data.modifyVerifier.algorithmName)) {
		return {
			kind: 'modifyVerifier',
			messageKey: 'pptx.readOnly.modifyVerifierRecommended',
			defaultReadOnly: true,
		};
	}
	if (isMarkedAsFinal(data.customProperties)) {
		return {
			kind: 'markedFinal',
			messageKey: 'pptx.readOnly.markedFinal',
			defaultReadOnly: true,
		};
	}
	return NOT_RECOMMENDED;
}
