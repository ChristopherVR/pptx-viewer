/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure, immutable group/ungroup tree operations were extracted to
 * `pptx-viewer-shared` (`render/group-ops`) and are consumed by every binding.
 * This shim preserves the historical Angular import surface so
 * `editor-state.service.ts` and the colocated test are unchanged. Angular
 * imports shared from `../internal/shared` (the vendored barrel), never the
 * bare `'pptx-viewer-shared'` specifier (which ng-packagr would externalize).
 */
export type { GroupResult, UngroupResult } from '../internal/shared';
export { groupElements, ungroupElements } from '../internal/shared';
