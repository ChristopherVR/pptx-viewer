import {
	BadgeCheck,
	Clock3,
	Copy,
	FileCode2,
	FileText,
	Image,
	Images,
	Info,
	LockKeyhole,
	Package,
	Presentation,
	Printer,
	Type,
	UserPlus,
	Video,
} from 'lucide';
import type { IconNode } from 'lucide';
import type { BackstagePage } from 'pptx-viewer-shared';

import { createEl } from '../../../render';
import type { RibbonFileHandlers } from '../ribbon-types';
import { button } from './file-tab-dom';
import { createLucideIcon } from './file-tab-icons';

export function createFileActionGrid(
	doc: Document,
	page: BackstagePage,
	handlers: RibbonFileHandlers,
	hasMacros: boolean,
	run: (callback: () => void) => void,
): HTMLElement {
	const grid = createEl(doc, 'div', 'pptxv-bs-actions');
	const action = (title: string, body: string, icon: IconNode, callback: () => void) => {
		const result = button(doc, '', () => run(callback));
		const glyph = doc.createElement('b');
		glyph.appendChild(createLucideIcon(doc, icon, 22));
		const copy = doc.createElement('span');
		const heading = doc.createElement('strong');
		heading.textContent = title;
		const text = doc.createElement('small');
		text.textContent = body;
		copy.append(heading, text);
		result.append(glyph, copy);
		return result;
	};
	if (page === 'saveAs') {
		grid.append(
			action('PowerPoint Presentation', 'Save an editable .pptx copy.', FileText, handlers.save),
			action('PowerPoint Show', 'Save a .ppsx slide show.', Presentation, handlers.saveAsPpsx),
			action(
				'Package for Sharing',
				'Bundle the deck and linked assets.',
				Package,
				handlers.packageForSharing,
			),
		);
		if (hasMacros) {
			grid.append(
				action(
					'Macro-Enabled Presentation',
					'Preserve VBA in a .pptm file.',
					FileCode2,
					handlers.saveAsPptm,
				),
			);
		}
	}
	if (page === 'export') {
		grid.append(
			action('Create PDF', 'Publish one page per slide.', FileText, handlers.exportPdf),
			action('Export current slide', 'Create a high-quality PNG.', Image, handlers.exportPng),
			action('Create a Video', 'Export timings and animations.', Video, handlers.exportVideo),
			action(
				'Create an Animated GIF',
				'Make a compact looping preview.',
				Images,
				handlers.exportGif,
			),
			action('Copy as Image', 'Copy the current slide.', Copy, handlers.copySlideAsImage),
		);
	}
	if (page === 'print') {
		grid.append(
			action('Print Presentation', 'Choose layout and output settings.', Printer, handlers.print),
		);
	}
	if (page === 'share') {
		grid.append(
			action(
				'Share with People',
				'Invite others to collaborate on this presentation.',
				UserPlus,
				handlers.openShare,
			),
			action(
				'Package for Sharing',
				'Download a self-contained package.',
				Package,
				handlers.packageForSharing,
			),
		);
	}
	if (page === 'info') {
		grid.append(
			action(
				'Version History',
				'Restore or remove the latest recovery snapshot.',
				Clock3,
				handlers.openVersionHistory,
			),
			action(
				'Document Properties',
				'View and edit presentation metadata and statistics.',
				Info,
				handlers.openDocumentProperties,
			),
			action(
				'Protect Presentation',
				'Control access and editing preferences.',
				LockKeyhole,
				handlers.openPasswordProtection,
			),
			action(
				'Embed Fonts',
				'Keep typography consistent across devices.',
				Type,
				handlers.openFontEmbedding,
			),
			action(
				'Digital Signatures',
				'View signatures attached to this presentation.',
				BadgeCheck,
				handlers.openDigitalSignatures,
			),
		);
	}
	return grid;
}
