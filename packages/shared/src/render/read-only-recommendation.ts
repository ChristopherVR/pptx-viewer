/**
 * read-only-recommendation.ts: whether a loaded deck asks to be opened
 * read-only, and why.
 *
 * Core parses two independent signals a `.pptx` can carry for this:
 * - `p:modifyVerifier` in `presentation.xml`: a password hash written by
 *   PowerPoint's "Protect Presentation > Restrict Editing" / the legacy
 *   "Set Password to Modify" flow. When it carries a hash this viewer can
 *   verify (see `checkModifyPassword`), lifting the lock requires that
 *   password, matching PowerPoint's own "read-only recommended" prompt; when
 *   it does not (an older/unsupported algorithm, or a bare recommendation
 *   with no hash) the deck still defaults to read-only but "Edit anyway"
 *   works without a password, since there is nothing to check it against.
 * - `docProps/custom.xml`'s well-known `_MarkAsFinal` custom property, which
 *   PowerPoint's "Mark as Final" writes. Unlike `modifyVerifier` this is not
 *   modelled as its own field (no reader-facing feature besides this one has
 *   needed it), so it is read out of the already-parsed `customProperties`
 *   list here rather than adding a core field for a single boolean. It never
 *   requires a password: PowerPoint's own "Edit Anyway" for it is unconditional.
 *
 * Both are recommendations, not enforcement: neither core nor this module
 * blocks a save, they only tell a binding what state to default a "read-only"
 * toggle to and what banner to show. Every binding surfaces it as the
 * read-only banner (editing stays locked until "Edit anyway", or until the
 * right password is entered when `requiresPassword` is set); before that a
 * deck opened this way was silently editable.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports (it does
 * import a small, dependency-free algorithm-name resolver from
 * `pptx-viewer-core`, the same way `modify-password-check.ts` does).
 */
import { resolveModifyVerifierAlgorithmName } from 'pptx-viewer-core';

/** The `PptxData` fields this decision reads. Declared structurally. */
export interface ReadOnlyRecommendationSource {
	readonly modifyVerifier?: {
		readonly hashData?: string;
		readonly saltData?: string;
		readonly algorithmName?: string;
		/** Legacy algorithm ID extension; an alternate name-carrying attribute. */
		readonly algIdExt?: string;
		/**
		 * Legacy CryptoAPI ALG_SID hash identifier. PowerPoint's own "Set
		 * Password to Modify" writes ONLY this (no `algorithmName`), so it must
		 * be checked to recognise a real PowerPoint-authored verifier as
		 * checkable; see `resolveModifyVerifierAlgorithmName` (`pptx-viewer-core`).
		 */
		readonly cryptAlgorithmSid?: number;
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
	/**
	 * Whether lifting this recommendation requires a correct password, rather
	 * than a plain "Edit anyway". True only for a `modifyVerifier` that carries
	 * a hash this viewer can actually check (`hashData` + `saltData` +
	 * `algorithmName`, see `checkModifyPassword`). "Mark as Final" is purely
	 * advisory and never requires one, and a `modifyVerifier` missing pieces of
	 * its hash cannot be verified either way, so both fall back to the plain
	 * "Edit anyway" a binding already had.
	 */
	readonly requiresPassword: boolean;
}

const NOT_RECOMMENDED: ReadOnlyRecommendation = {
	kind: null,
	messageKey: '',
	defaultReadOnly: false,
	requiresPassword: false,
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
	const verifier = data.modifyVerifier;
	if (verifier && (verifier.hashData || verifier.algorithmName)) {
		return {
			kind: 'modifyVerifier',
			messageKey: 'pptx.readOnly.modifyVerifierRecommended',
			defaultReadOnly: true,
			// A hash this viewer can actually check requires the password before
			// "Edit anyway" can lift the lock; anything less (no salt, or an
			// algorithm this resolver does not recognise) cannot be verified, so
			// it falls back to the plain "Edit anyway" every other recommendation
			// already has.
			requiresPassword: Boolean(
				verifier.hashData && verifier.saltData && resolveModifyVerifierAlgorithmName(verifier),
			),
		};
	}
	if (isMarkedAsFinal(data.customProperties)) {
		return {
			kind: 'markedFinal',
			messageKey: 'pptx.readOnly.markedFinal',
			defaultReadOnly: true,
			requiresPassword: false,
		};
	}
	return NOT_RECOMMENDED;
}
