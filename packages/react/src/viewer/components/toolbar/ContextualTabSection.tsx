import type { RibbonContextualTabId } from 'pptx-viewer-shared';
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import React from 'react';
import { LuSparkles } from 'react-icons/lu';

import { RibbonGroup } from './PowerPointRibbonControls';
import { RibbonGallery } from './RibbonGallery';
import { useTranslateOr } from './RibbonGalleryPopup';
import { ics } from './toolbar-constants';

/**
 * A contextual tab's ribbon content (Shape Format, Picture Format, Table
 * Design, ...): the groups shared lists for it, each holding its galleries.
 */
export function ContextualTabSection({ tab }: { tab: RibbonContextualTabId }): React.ReactElement {
	const translateOr = useTranslateOr();
	return (
		<>
			{CONTEXTUAL_TAB_GROUPS[tab].map((group) => (
				<RibbonGroup
					key={group.group}
					groupId={group.group}
					label={translateOr(group.labelKey, group.label)}
					className='items-center'
				>
					{group.galleries.map((placement) => (
						<RibbonGallery
							key={placement.control}
							placement={placement}
							icon={<LuSparkles className={ics} />}
						/>
					))}
				</RibbonGroup>
			))}
		</>
	);
}
