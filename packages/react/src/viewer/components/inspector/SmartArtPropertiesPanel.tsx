import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNodeStyle,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';
import {
	addSmartArtNodeAsChild,
	removeSmartArtNode,
	setSmartArtNodeStyle,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import { rebuildDrawingShapesIfCleared } from 'pptx-viewer-shared';
import type { BoundingBox } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { resolveSmartArtDataPalette } from '../../utils/smartart-helpers';
import { HEADING, CARD, INPUT, BTN } from './inspector-pane-constants';
import {
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
} from './smartart-node-limits';
import {
	addSiblingAfter,
	demote,
	promote,
	removeEmptyNode,
	reorder,
	siblingCount,
	siblingIndex,
} from './smartart-node-pane-handlers';
import { SmartArtLayoutSwitcher } from './SmartArtLayoutSwitcher';
import { SmartArtNodeRow } from './SmartArtNodeRow';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SmartArtPropertiesPanelProps {
	smartArtData: PptxSmartArtData;
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
	/** Pixel bounding box of the element, used to rebuild drawing shapes after structural edits. */
	box?: BoundingBox;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_SCHEMES: SmartArtColorScheme[] = [
	'colorful1',
	'colorful2',
	'colorful3',
	'monochromatic1',
	'monochromatic2',
];

const STYLE_OPTIONS: SmartArtStyle[] = ['flat', 'moderate', 'intense'];

/** Connection types that represent the plain parent/child tree we edit inline. */
const TREE_CONNECTION_TYPES = new Set(['parOf', 'presParOf', undefined]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmartArtPropertiesPanel({
	smartArtData,
	canEdit,
	onUpdateElement,
	box,
}: SmartArtPropertiesPanelProps): React.ReactElement {
	const { t } = useTranslation();
	const nodes = smartArtData.nodes ?? [];
	const layout = smartArtData.resolvedLayoutType;
	const topLevelCount = nodes.filter((n) => !n.parentId).length;

	// Focus the input of a node after a structural edit (Enter / Delete / move).
	const inputRefs = React.useRef<Map<string, HTMLInputElement | null>>(new Map());
	const pendingFocusId = React.useRef<string | null>(null);

	React.useEffect(() => {
		const id = pendingFocusId.current;
		if (id) {
			inputRefs.current.get(id)?.focus();
			pendingFocusId.current = null;
		}
	});

	const applySmartArtData = (newData: PptxSmartArtData, focusId?: string) => {
		if (focusId) {
			pendingFocusId.current = focusId;
		}
		const reflowed = box
			? rebuildDrawingShapesIfCleared(
					newData,
					newData.layout,
					resolveSmartArtDataPalette(newData),
					newData.style ?? 'flat',
					'inspector',
					box,
				)
			: newData;
		onUpdateElement({ smartArtData: reflowed } as Partial<PptxElement>);
	};

	const updateSmartArt = (patch: Partial<PptxSmartArtData>) => {
		applySmartArtData({ ...smartArtData, ...patch });
	};

	const handleUpdateNodeText = (nodeId: string, text: string) => {
		applySmartArtData(updateSmartArtNodeText(smartArtData, nodeId, text));
	};

	const handleChangeNodeStyle = (nodeId: string, patch: Partial<PptxSmartArtNodeStyle>) => {
		const next = setSmartArtNodeStyle(smartArtData, nodeId, patch);
		if (next !== smartArtData) {
			applySmartArtData(next);
		}
	};

	const addNode = () => {
		if (!canAddTopLevelNode(layout, topLevelCount)) {
			return;
		}
		applySmartArtData(addSmartArtNodeAsChild(smartArtData));
	};

	const addSubItem = (parentId: string) => {
		applySmartArtData(addSmartArtNodeAsChild(smartArtData, parentId, 'Sub-item'));
	};

	const removeNode = (nodeId: string) => {
		const isTopLevel = !nodes.find((n) => n.id === nodeId)?.parentId;
		if (isTopLevel && !canRemoveTopLevelNode(layout, topLevelCount)) {
			return;
		}
		applySmartArtData(removeSmartArtNode(smartArtData, nodeId));
	};

	const moveNode = (nodeId: string, direction: 1 | -1) => {
		const next = reorder(smartArtData, nodeId, direction);
		if (next) {
			applySmartArtData(next, nodeId);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
		const node = nodes.find((n) => n.id === nodeId);
		const isEmpty = !node?.text;

		if (e.key === 'Enter') {
			e.preventDefault();
			const result = addSiblingAfter(smartArtData, nodeId);
			if (result) {
				applySmartArtData(result.data, result.focusNodeId);
			}
		} else if ((e.key === 'Backspace' || e.key === 'Delete') && isEmpty) {
			const isTop = !node?.parentId;
			if (isTop && !canRemoveTopLevelNode(layout, topLevelCount)) {
				return;
			}
			e.preventDefault();
			const result = removeEmptyNode(smartArtData, nodeId);
			if (result) {
				applySmartArtData(result.data, result.focusNodeId);
			}
		} else if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			const next = demote(smartArtData, nodeId);
			if (next) {
				applySmartArtData(next, nodeId);
			}
		} else if (e.key === 'Tab' && e.shiftKey) {
			e.preventDefault();
			const next = promote(smartArtData, nodeId);
			if (next) {
				applySmartArtData(next, nodeId);
			}
		}
	};

	const setInputRef = (nodeId: string) => (el: HTMLInputElement | null) => {
		if (el) {
			inputRefs.current.set(nodeId, el);
		} else {
			inputRefs.current.delete(nodeId);
		}
	};

	const boundsHint = describeSmartArtBounds(layout);
	const addDisabled = !canEdit || !canAddTopLevelNode(layout, topLevelCount);

	// Connections beyond the editable parent/child tree (read-only awareness).
	const extraConnections = (smartArtData.connections ?? []).filter(
		(c) => !TREE_CONNECTION_TYPES.has(c.type),
	);
	// Human-readable summary of the distinct relationship types, e.g. "presOf, presParOf".
	const extraConnectionSummary = Array.from(
		new Set(extraConnections.map((c) => c.type ?? 'unknown')),
	).join(', ');

	let topDisplayIndex = 0;

	return (
		<div className={CARD} role='group' aria-label={t('pptx.smartart.title')}>
			<div className={HEADING}>{t('pptx.smartart.title')}</div>
			<div className='space-y-2'>
				<SmartArtLayoutSwitcher
					smartArtData={smartArtData}
					canEdit={canEdit}
					onUpdateSmartArt={updateSmartArt}
				/>

				<label className='flex flex-col gap-1 text-[11px]'>
					<span className='text-muted-foreground'>{t('pptx.smartart.colorScheme')}</span>
					<select
						disabled={!canEdit}
						data-testid='smartart-color-scheme'
						aria-label={t('pptx.smartart.colorScheme')}
						className={cn(INPUT, 'w-full')}
						value={smartArtData.colorScheme ?? 'colorful1'}
						onChange={(e) => updateSmartArt({ colorScheme: e.target.value as SmartArtColorScheme })}
					>
						{COLOR_SCHEMES.map((cs) => (
							<option key={cs} value={cs}>
								{cs}
							</option>
						))}
					</select>
				</label>

				<label className='flex flex-col gap-1 text-[11px]'>
					<span className='text-muted-foreground'>{t('pptx.smartart.style')}</span>
					<div className='flex gap-1' role='group' aria-label={t('pptx.smartart.style')}>
						{STYLE_OPTIONS.map((s) => (
							<button
								key={s}
								type='button'
								disabled={!canEdit}
								aria-pressed={(smartArtData.style ?? 'flat') === s}
								className={cn(
									'flex-1 px-2 py-1 text-[10px] rounded border transition-colors',
									(smartArtData.style ?? 'flat') === s
										? 'border-primary bg-primary/20 text-primary'
										: 'border-border text-muted-foreground hover:bg-muted',
								)}
								onClick={() => updateSmartArt({ style: s })}
							>
								{s}
							</button>
						))}
					</div>
				</label>

				<div className='flex items-center justify-between'>
					<span className='text-[11px] text-muted-foreground'>
						{t('pptx.smartart.textPane')} ({nodes.length})
					</span>
					<button
						type='button'
						disabled={addDisabled}
						className={BTN}
						onClick={addNode}
						title={addDisabled ? boundsHint : undefined}
					>
						{t('pptx.smartart.addItem')}
					</button>
				</div>

				{boundsHint && (
					<div className='text-[9px] text-muted-foreground' role='note'>
						{boundsHint}
					</div>
				)}

				<div className='max-h-52 overflow-y-auto space-y-1 pr-1' role='list'>
					{nodes.map((node) => {
						const isChild = Boolean(node.parentId);
						if (!isChild) {
							topDisplayIndex += 1;
						}
						const sIdx = siblingIndex(smartArtData, node.id);
						const sCount = siblingCount(smartArtData, node.id);
						const removeDisabled =
							nodes.length <= 1 || (!isChild && !canRemoveTopLevelNode(layout, topLevelCount));
						return (
							<SmartArtNodeRow
								key={node.id}
								nodeId={node.id}
								text={node.text}
								displayIndex={topDisplayIndex}
								isChild={isChild}
								canEdit={canEdit}
								removeDisabled={removeDisabled}
								moveUpDisabled={sIdx <= 0}
								moveDownDisabled={sIdx < 0 || sIdx >= sCount - 1}
								inputRef={setInputRef(node.id)}
								style={node.style}
								onChangeText={handleUpdateNodeText}
								onKeyDown={handleKeyDown}
								onAddSubItem={addSubItem}
								onMoveUp={(id) => moveNode(id, -1)}
								onMoveDown={(id) => moveNode(id, 1)}
								onRemove={removeNode}
								onChangeStyle={handleChangeNodeStyle}
							/>
						);
					})}
				</div>

				{extraConnections.length > 0 && (
					<div
						className='text-[9px] text-muted-foreground'
						role='note'
						aria-label={`${extraConnections.length} non-tree relationship connection(s): ${extraConnectionSummary}`}
					>
						{t('pptx.smartart.extraConnections', { count: extraConnections.length })}
						<span className='block opacity-80'>{extraConnectionSummary}</span>
					</div>
				)}

				<div className='text-[9px] text-muted-foreground mt-1'>{t('pptx.smartart.tabHint')}</div>
			</div>
		</div>
	);
}
