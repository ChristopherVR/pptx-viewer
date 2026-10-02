/**
 * The strip itself is the shared `pptx-ui-presenter-console` (see
 * `PresenterConsoleStrip.svelte`), and its on and disabled rule is the shared
 * `presenterConsoleViewState`. What stays here is the type guard the console host
 * uses to tell an annotation-tool slot from the others.
 *
 * @module viewer/components/presenter-console-strip
 */
import type { PresentationPointerTool } from 'pptx-viewer-shared';

/** The four annotation tools, which are also their own control ids. */
const POINTER_TOOLS: readonly PresentationPointerTool[] = ['laser', 'pen', 'highlighter', 'eraser'];

/**
 * Whether a strip control id names an annotation tool.
 *
 * A type guard rather than a cast at the call site: the console dispatches on
 * the shared inventory's `string` ids, and narrowing here is what keeps
 * `setTool` free of an unchecked assertion.
 */
export function isPresenterPointerTool(id: string): id is PresentationPointerTool {
	return (POINTER_TOOLS as readonly string[]).includes(id);
}
