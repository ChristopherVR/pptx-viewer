/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * URL safety + `ppaction://` detection + renderable-href resolution were
 * consolidated into `pptx-viewer-shared` (`render/hyperlink-security.ts`),
 * shared by every binding. This shim keeps the historical Angular import
 * surface (the viewer-first subset used to render safe `<a href>` links) so the
 * element renderer, the public barrel, and the colocated tests are unchanged.
 */
export {
	isUrlSafe,
	isPpactionUrl,
	resolveHyperlinkHref,
} from '../internal/shared-src/render/hyperlink-security';
