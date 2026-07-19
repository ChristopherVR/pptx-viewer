import type { ViewerOptions } from 'pptx-viewer-shared';
import { DEFAULT_VIEWER_OPTIONS } from 'pptx-viewer-shared';
import { createContext, useContext } from 'react';

/**
 * Shares the live File > Options snapshot with deep chrome components
 * (ribbon, title bar, backstage, dialogs) without threading it through
 * every intermediate prop list. `PowerPointViewer` provides the value;
 * consumers fall back to the shared defaults when rendered standalone
 * (unit tests, storybook-style harnesses).
 */
export const ViewerOptionsContext = createContext<ViewerOptions>(DEFAULT_VIEWER_OPTIONS);

/** Read the current File > Options snapshot (defaults when unprovided). */
export function useViewerOptionsContext(): ViewerOptions {
	return useContext(ViewerOptionsContext);
}
