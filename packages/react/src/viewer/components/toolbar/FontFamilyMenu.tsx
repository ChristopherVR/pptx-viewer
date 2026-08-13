import { buildFontCatalog } from 'pptx-viewer-shared';
import type { FontCatalogEntry } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RibbonMenu } from './RibbonMenu';

export interface FontFamilyMenuProps {
	anchorRef: React.RefObject<HTMLDivElement | null>;
	/** Theme major/minor latin faces, shown first and labelled by role. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds via `p:embeddedFontLst`. */
	embeddedFonts?: readonly string[];
	/** Families registered this session from File &gt; Options &gt; Fonts. */
	customFonts?: readonly string[];
	onSelect: (family: string) => void;
}

/**
 * The Home tab's font dropdown, grouped the way PowerPoint groups it.
 *
 * Every row previews itself in its own family, so the list can be scanned by
 * shape rather than by name. The grouping and de-duplication rules live in
 * `pptx-viewer-shared` so all five bindings show the same list.
 */
export function FontFamilyMenu(p: FontFamilyMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const groups = buildFontCatalog({
		themeFonts: p.themeFonts,
		embeddedFonts: p.embeddedFonts,
		customFonts: p.customFonts,
	});

	return (
		<RibbonMenu anchorRef={p.anchorRef} className='flex flex-col w-64 pt-1'>
			<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-80 overflow-y-auto'>
				{groups.map((group, groupIndex) => (
					<React.Fragment key={group.id}>
						<div
							className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground${
								groupIndex > 0 ? ' border-t border-border/60 mt-1' : ''
							}`}
						>
							{t(group.labelKey)}
						</div>
						{group.entries.map((entry) => (
							<FontRow key={`${group.id}-${entry.family}`} entry={entry} onSelect={p.onSelect} />
						))}
					</React.Fragment>
				))}
			</div>
		</RibbonMenu>
	);
}

function FontRow({
	entry,
	onSelect,
}: {
	entry: FontCatalogEntry;
	onSelect: (family: string) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<button
			type='button'
			className='flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
			style={{ fontFamily: entry.family }}
			onClick={() => onSelect(entry.family)}
		>
			<span className='truncate'>{entry.family}</span>
			{entry.themeRole && (
				<span className='shrink-0 text-[10px] text-muted-foreground'>
					{t(`pptx.font.role.${entry.themeRole}`)}
				</span>
			)}
		</button>
	);
}
