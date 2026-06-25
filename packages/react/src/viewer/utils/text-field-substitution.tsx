/**
 * Text-field placeholder substitution.
 *
 * The implementation is framework-agnostic and now lives in
 * `pptx-viewer-shared` (`render/text-field-substitution`). This module re-exports
 * it so existing React import paths (`./text-field-substitution`) keep working.
 */
export type { FieldSubstitutionContext } from 'pptx-viewer-shared';
export { resolveFieldDateText, substituteFieldText } from 'pptx-viewer-shared';
