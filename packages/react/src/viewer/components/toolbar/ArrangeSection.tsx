import type { PptxElement } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuChevronDown,
	LuChevronUp,
	LuClipboardPaste,
	LuCopy,
	LuPaintbrush,
	LuTrash2,
} from 'react-icons/lu';

import type { ElementClipboardPayload } from '../../types';
import { cn } from '../../utils';
import { gB, gL, grp, ic, pill, ALIGN_BTNS } from './toolbar-constants';

export interface ArrangeSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	clipboardPayload: ElementClipboardPayload | null;
	onAlignElements: (align: string) => void;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onFlip: (direction: 'horizontal' | 'vertical') => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	formatPainterActive?: boolean;
	onToggleFormatPainter?: () => void;
	canActivateFormatPainter?: boolean;
}

export function ArrangeSection(p: ArrangeSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const hasSel = Boolean(p.selectedElement);
	const canMut = hasSel && p.canEdit;

	return (
		<>
			<div className={grp}>
				{ALIGN_BTNS.map((a, i, arr) => (
					<button
						key={a.k}
						type='button'
						onClick={() => p.onAlignElements(a.k)}
						disabled={!canMut}
						className={i < arr.length - 1 ? gB : gL}
						title={t('pptx.arrange.align', { direction: a.k })}
					>
						{a.el}
					</button>
				))}
			</div>
			<div className={grp}>
				<button onClick={p.onCopy} disabled={!hasSel} className={gB} title={t('pptx.arrange.copy')}>
					<LuCopy className={ic} />
				</button>
				<button onClick={p.onCut} disabled={!canMut} className={gB} title={t('pptx.arrange.cut')}>
					{t('pptx.arrange.cut')}
				</button>
				<button
					onClick={p.onPaste}
					disabled={!p.clipboardPayload || !p.canEdit}
					className={gL}
					title={t('pptx.arrange.paste')}
				>
					<LuClipboardPaste className={ic} />
				</button>
			</div>
			{p.onToggleFormatPainter && (
				<button
					type='button'
					onClick={p.onToggleFormatPainter}
					disabled={!p.canEdit || (p.canActivateFormatPainter === false && !p.formatPainterActive)}
					data-testid='format-painter-toggle'
					className={cn(
						pill,
						p.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '',
					)}
					title={t('pptx.arrange.formatPainter')}
				>
					<LuPaintbrush className={ic} />
					{t('pptx.arrange.format')}
				</button>
			)}
			<div className={grp}>
				<button
					type='button'
					onClick={() => p.onFlip('horizontal')}
					disabled={!canMut}
					className={gB}
					title={t('pptx.arrange.flipHorizontally')}
				>
					{t('pptx.arrange.flipH')}
				</button>
				<button
					type='button'
					onClick={() => p.onFlip('vertical')}
					disabled={!canMut}
					className={gL}
					title={t('pptx.arrange.flipVertically')}
				>
					{t('pptx.arrange.flipV')}
				</button>
			</div>
			<div className={grp}>
				<button
					onClick={() => p.onMoveLayer('backward')}
					disabled={!canMut}
					className={gB}
					title={t('pptx.arrange.sendBackward')}
				>
					<LuChevronDown className={ic} />
				</button>
				<button
					onClick={() => p.onMoveLayer('forward')}
					disabled={!canMut}
					className={gB}
					title={t('pptx.arrange.bringForward')}
				>
					<LuChevronUp className={ic} />
				</button>
				<button
					onClick={() => p.onMoveLayerToEdge('back')}
					disabled={!canMut}
					className={gB}
					title={t('pptx.arrange.sendToBack')}
				>
					{t('pptx.arrange.back')}
				</button>
				<button
					onClick={() => p.onMoveLayerToEdge('front')}
					disabled={!canMut}
					className={gL}
					title={t('pptx.arrange.bringToFront')}
				>
					{t('pptx.arrange.front')}
				</button>
			</div>
			<button
				onClick={p.onDuplicate}
				disabled={!canMut}
				className={pill}
				title={t('pptx.arrange.duplicate')}
			>
				<LuCopy className={ic} />
				{t('pptx.arrange.duplicate')}
			</button>
			<button
				onClick={p.onDelete}
				disabled={!canMut}
				className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-700/80 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors'
				title={t('pptx.arrange.delete')}
			>
				<LuTrash2 className={ic} />
				{t('pptx.arrange.delete')}
			</button>
		</>
	);
}
