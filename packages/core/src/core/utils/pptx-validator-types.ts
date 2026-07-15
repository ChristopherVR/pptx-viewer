/**
 * Public types and shared constants for PPTX validation and repair.
 *
 * This module defines the interfaces returned by {@link validatePptx} and
 * {@link repairPptx}, as well as the constant tables used by both the
 * validation and repair pipelines.
 *
 * @module utils/pptx-validator-types
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single issue discovered during PPTX validation. */
export interface ValidationIssue {
	severity: 'error' | 'warning' | 'info';
	code: string;
	message: string;
	/** Internal ZIP path the issue relates to, if applicable. */
	path?: string;
}

/** Aggregate result of a PPTX validation pass. */
export interface ValidationResult {
	/** True when no errors were found by the package and rule-based checks. */
	valid: boolean;
	issues: ValidationIssue[];
	/** Scope and dialect detected by the rule-based ECMA-376 checks. */
	conformance: ValidationConformance;
}

/** This validator is substantive but does not replace validation against every ECMA XSD. */
export interface ValidationConformance {
	level: 'rule-checked' | 'not-checked';
	dialect: 'strict' | 'transitional' | 'mixed' | 'unknown';
	description: string;
}

/** Result of a PPTX repair operation. */
export interface RepairResult {
	repaired: ArrayBuffer;
	repairs: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Files that must exist in every valid PPTX package. */
export const REQUIRED_PATHS = [
	'[Content_Types].xml',
	'_rels/.rels',
	'ppt/presentation.xml',
] as const;

/** Well-known content type mappings by file extension. */
export const EXTENSION_CONTENT_TYPES: Record<string, string> = {
	rels: 'application/vnd.openxmlformats-package.relationships+xml',
	xml: 'application/xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	emf: 'image/x-emf',
	wmf: 'image/x-wmf',
	svg: 'image/svg+xml',
	mp4: 'video/mp4',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	bin: 'application/vnd.ms-office.vbaProject',
};

/** Part-name to content type for common PPTX override parts. */
export const PART_CONTENT_TYPES: Record<string, string> = {
	'/ppt/presentation.xml':
		'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
	'/ppt/presProps.xml':
		'application/vnd.openxmlformats-officedocument.presentationml.presProps+xml',
	'/ppt/viewProps.xml':
		'application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml',
	'/ppt/tableStyles.xml':
		'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml',
	'/docProps/core.xml': 'application/vnd.openxmlformats-package.core-properties+xml',
	'/docProps/app.xml': 'application/vnd.ms-officedocument.extended-properties+xml',
};

/** Content type for slide parts. */
export const SLIDE_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

/** Content type for slide layout parts. */
export const SLIDE_LAYOUT_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml';

/** Content type for slide master parts. */
export const SLIDE_MASTER_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml';

/** Content type for theme parts. */
export const THEME_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';
