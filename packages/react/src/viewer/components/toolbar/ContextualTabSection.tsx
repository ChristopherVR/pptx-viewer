import type { RibbonContextualTabId } from 'pptx-viewer-shared';
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import React from 'react';

import { RibbonGallery } from './RibbonGallery';
import { useTranslateOr } from './useGalleryTranslation';
import { WebRibbonGroup } from './WebRibbonControls';

/**
 * A contextual tab's ribbon content (Shape Format, Picture Format, Table
 * Design, ...): the groups shared lists for it, each holding its galleries.
 */
export function ContextualTabSection({ tab }: { tab: RibbonContextualTabId }): React.ReactElement {
	const translateOr = useTranslateOr();
	return (
		<>
			{CONTEXTUAL_TAB_GROUPS[tab].map((group) => (
				<WebRibbonGroup
					key={group.group}
					groupId={group.group}
					label={translateOr(group.labelKey, group.label)}
				>
					{group.galleries.map((placement) => (
						<RibbonGallery key={placement.control} placement={placement} />
					))}
				</WebRibbonGroup>
			))}
		</>
	);
}
