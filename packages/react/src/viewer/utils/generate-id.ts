/**
 * Unique element-id generation now lives in `pptx-viewer-shared`
 * (`render/element-clipboard.ts`) so every binding mints identical ids. This
 * module stays as a thin re-export shim for the existing React import sites.
 */
export { generateElementId } from 'pptx-viewer-shared';
