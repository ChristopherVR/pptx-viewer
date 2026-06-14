/**
 * Public types for the Angular PowerPoint viewer.
 *
 * The framework-agnostic `CanvasSize`, `CollaborationConfig`, and
 * `CollaborationRole` types live in `pptx-viewer-shared` and are re-exported
 * for API parity with the React (`types-ui.ts`) and Vue (`viewer/types.ts`)
 * packages.
 *
 * Angular conventions differ from React/Vue:
 *  - React function-prop callbacks (`onDirtyChange`, …) and Vue emits become
 *    Angular `@Output()` `EventEmitter`s on the component.
 *  - The React `forwardRef` handle / Vue `defineExpose` becomes public methods
 *    on the component instance, reachable via a template reference variable or
 *    `viewChild`.
 */
export type { CanvasSize, CollaborationConfig, CollaborationRole } from '../internal/shared';
