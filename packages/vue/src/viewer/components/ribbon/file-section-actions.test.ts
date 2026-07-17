import { describe, expect, it } from 'vitest';

import { buildFileSectionActions } from './file-section-actions';
import type { FileSectionProps } from './file-section-types';

function noopProps(): FileSectionProps {
	return {
		onClose: () => {},
		onCreatePresentation: () => {},
		onExportPng: () => {},
		onExportPdf: () => {},
		onExportVideo: () => {},
		onExportGif: () => {},
		onPackageForSharing: () => {},
		onSaveAsPptx: () => {},
		onSaveAsPpsx: () => {},
		onSaveAsPptm: () => {},
		hasMacros: false,
		onCopySlideAsImage: () => {},
		onPrint: () => {},
	};
}

/**
 * buildFileSectionActions: the File-tab backstage action-card list, extracted
 * from `FileSection.vue`. Covers the `hiddenActions` gating added for issue
 * #64: the Export page's cards (PNG/PDF/Video/GIF/Copy-as-Image) all map to
 * the shared 'export' ToolbarActionId, so hiding it empties that page while
 * leaving every other page untouched.
 */
describe('buildFileSectionActions', () => {
	const notHidden = () => false;
	const hideExport = (id: string) => id === 'export';

	it('returns the five export cards by default (hiddenActions omitted → not hidden)', () => {
		const actions = buildFileSectionActions('export', noopProps(), notHidden);
		expect(actions).toHaveLength(5);
		expect(actions.map((action) => action[0])).toContain('Create PDF');
	});

	it('returns no cards on the export page when "export" is hidden', () => {
		const actions = buildFileSectionActions('export', noopProps(), hideExport);
		expect(actions).toHaveLength(0);
	});

	it('leaves the saveAs page unaffected when "export" is hidden', () => {
		const actions = buildFileSectionActions('saveAs', noopProps(), hideExport);
		expect(actions.length).toBeGreaterThan(0);
		expect(actions.map((action) => action[0])).toContain('PowerPoint Presentation');
	});

	it('includes the macro-enabled card on saveAs only when hasMacros is true', () => {
		const withMacros = buildFileSectionActions(
			'saveAs',
			{ ...noopProps(), hasMacros: true },
			notHidden,
		);
		expect(withMacros.map((action) => action[0])).toContain('Macro-Enabled Presentation');

		const withoutMacros = buildFileSectionActions('saveAs', noopProps(), notHidden);
		expect(withoutMacros.map((action) => action[0])).not.toContain('Macro-Enabled Presentation');
	});
});
