import * as pptxReactViewer from 'pptx-react-viewer';
/**
 * `@christophervr/pptx-viewer` doubles as a drop-in for `pptx-react-viewer`:
 * importing the package root (as opposed to running it via `npx`/`bin`) must
 * resolve the real React viewer, not the installer. This is a regression
 * test for that re-export - see the "It's also a drop-in for
 * pptx-react-viewer" section of the package README.
 */
import { describe, expect, it } from 'vitest';

import * as pptxViewerCli from './index';

describe('package root re-export', () => {
	it('re-exports the main viewer component', () => {
		expect(pptxViewerCli.PowerPointViewer).toBeDefined();
		expect(pptxViewerCli.PowerPointViewer).toBe(pptxReactViewer.PowerPointViewer);
	});

	it('re-exports the standalone building blocks', () => {
		expect(pptxViewerCli.Toolbar).toBe(pptxReactViewer.Toolbar);
		expect(pptxViewerCli.SlideCanvas).toBe(pptxReactViewer.SlideCanvas);
		expect(pptxViewerCli.useViewerBuildingBlocks).toBe(pptxReactViewer.useViewerBuildingBlocks);
	});

	it('re-exports theme helpers', () => {
		expect(pptxViewerCli.ViewerThemeProvider).toBe(pptxReactViewer.ViewerThemeProvider);
		expect(pptxViewerCli.useViewerTheme).toBe(pptxReactViewer.useViewerTheme);
		expect(pptxViewerCli.THEME_CATALOG).toBe(pptxReactViewer.THEME_CATALOG);
	});

	it('re-exports everything pptx-react-viewer exports, with nothing extra', () => {
		expect(Object.keys(pptxViewerCli).sort()).toStrictEqual(Object.keys(pptxReactViewer).sort());
	});
});
