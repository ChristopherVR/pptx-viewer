/**
 * PPTX file validation and repair utilities.
 *
 * Validates the structural integrity of a PPTX (OOXML) package
 * without fully loading it into the runtime. Optionally repairs
 * common issues such as missing content types, dangling relationship
 * references, and malformed XML.
 *
 * This module re-exports everything from the underlying sub-modules
 * so that existing consumers can continue to import from
 * `"./pptx-validator"` without changes.
 *
 * @module utils/pptx-validator
 */

export type {
	ValidationConformance,
	ValidationIssue,
	ValidationResult,
	RepairResult,
} from './pptx-validator-types';

export { validatePptx } from './pptx-validator-checks';
export { repairPptx } from './pptx-validator-repair';
