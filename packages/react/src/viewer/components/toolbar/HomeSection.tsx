import type { PptxElement, PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import React from 'react';

import type { ElementClipboardPayload } from '../../types';
import { ClipboardGroup } from './ClipboardGroup';
import { SlidesGroup } from './SlidesGroup';
import { sep } from './toolbar-constants';

export interface HomeSectionProps {
	canEdit: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
	layoutOptions: PptxLayoutOption[];
	/** Marks the active tile in the Layout menu. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
	selectedElement?: PptxElement | null;
}

export function HomeSection(p: HomeSectionProps): React.ReactElement {
	// Cut and Copy act on the selection, so with nothing selected they are
	// no-ops. They used to render live anyway, which offered the user a button
	// that could not do anything and disagreed with the Svelte binding.
	const hasSelection = Boolean(p.selectedElement);

	return (
		<>
			<ClipboardGroup
				canEdit={p.canEdit}
				hasSelection={hasSelection}
				canPaste={Boolean(p.clipboardPayload)}
				formatPainterActive={p.formatPainterActive}
				canActivateFormatPainter={p.canActivateFormatPainter}
				onCopy={p.onCopy}
				onCut={p.onCut}
				onPaste={p.onPaste}
				onToggleFormatPainter={p.onToggleFormatPainter}
			/>

			{sep}

			<SlidesGroup
				canEdit={p.canEdit}
				layoutOptions={p.layoutOptions}
				currentLayoutPath={p.currentLayoutPath}
				loadLayoutPreviews={p.loadLayoutPreviews}
				onInsertSlideFromLayout={p.onInsertSlideFromLayout}
				onInsertSlideFromTemplate={p.onInsertSlideFromTemplate}
				templateScheme={p.templateScheme}
				onApplyLayout={p.onApplyLayout}
				onResetSlide={p.onResetSlide}
				onAddSection={p.onAddSection}
			/>

		</>
	);
}
