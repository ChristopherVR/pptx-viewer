import {
	MERGE_SHAPES_HINT_KEY,
	MERGE_SHAPES_LABEL_KEY,
	MERGE_SHAPES_MENU_ITEMS,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuCombine } from 'react-icons/lu';

import { useShapeFormatContext } from '../shape-format-context';
import { RibbonMenu } from './RibbonMenu';
import { ic, pill } from './toolbar-constants';
import {
	RIBBON_MENU_ITEM_CLASS,
	RIBBON_MENU_SURFACE_CLASS,
	useRibbonDropdown,
} from './useRibbonDropdown';

export interface MergeShapesMenuProps {
	canEdit: boolean;
}

/**
 * Home > Arrange > Merge Shapes: a dropdown listing Union, Combine, Fragment,
 * Intersect and Subtract, in PowerPoint's order, from the shared menu data.
 * Enabled only for two or more mergeable shapes on an editable deck.
 */
export function MergeShapesMenu({ canEdit }: MergeShapesMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const commands = useShapeFormatContext();
	const { open, setOpen, ref } = useRibbonDropdown();
	const enabled = canEdit && Boolean(commands?.canMergeShapes);
	const label = t(MERGE_SHAPES_LABEL_KEY);
	return (
		<div className='relative' ref={ref}>
			<button
				type='button'
				data-pptx-ribbon-control='merge-shapes'
				aria-label={label}
				aria-haspopup='menu'
				aria-expanded={open && enabled}
				title={enabled ? label : t(MERGE_SHAPES_HINT_KEY)}
				disabled={!enabled}
				className={pill}
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => setOpen((v) => !v)}
			>
				<LuCombine className={ic} />
				<LuChevronDown className='w-3 h-3' />
			</button>
			{open && enabled && (
				<RibbonMenu anchorRef={ref} className='pt-1'>
					<div role='menu' aria-label={label} className={RIBBON_MENU_SURFACE_CLASS}>
						{MERGE_SHAPES_MENU_ITEMS.map((item) => (
							<button
								key={item.operation}
								type='button'
								role='menuitem'
								data-pptx-merge-op={item.operation}
								className={RIBBON_MENU_ITEM_CLASS}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									setOpen(false);
									commands?.mergeShapes(item.operation);
								}}
							>
								{t(item.labelKey)}
							</button>
						))}
					</div>
				</RibbonMenu>
			)}
		</div>
	);
}
