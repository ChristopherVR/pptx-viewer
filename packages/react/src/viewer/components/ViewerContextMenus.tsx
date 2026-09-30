import { resetSlideLayoutPath, resolveEditPointsAvailability } from 'pptx-viewer-shared';

import { ContextMenu, CanvasContextMenu } from '.';
import type { ViewerMainContentProps } from './viewer-main-content-types';

type Props = Pick<
	ViewerMainContentProps,
	| 'state'
	| 'mode'
	| 'selectedElement'
	| 'activeSlideIndex'
	| 'aiPanel'
	| 'activeSlide'
	| 'onApplyLayout'
	| 'editorOps'
> & { setLayoutGalleryAnchor: (anchor: { x: number; y: number }) => void };
export function ViewerContextMenus(props: Props) {
	const {
		state,
		mode,
		selectedElement,
		activeSlideIndex,
		aiPanel,
		activeSlide,
		onApplyLayout,
		editorOps,
		setLayoutGalleryAnchor,
	} = props;
	const { manipulation, tableOps } = editorOps;
	return (
		<>
			{state.contextMenuState && (
				<ContextMenu
					slideIndex={activeSlideIndex}
					elementIds={state.effectiveSelectedIds}
					contextMenuState={state.contextMenuState}
					mode={mode}
					selectedElement={selectedElement}
					tableEditorState={state.tableEditorState}
					hasMultiSelection={state.effectiveSelectedIds.length > 1}
					selectionGroupable={manipulation.selectionGroupable}
					hasClipboard={Boolean(state.clipboardPayload)}
					editPointsAvailability={resolveEditPointsAvailability(selectedElement)}
					onAction={manipulation.handleContextMenuAction}
					onInsertTableRow={tableOps.handleInsertTableRow}
					onDeleteTableRow={tableOps.handleDeleteTableRow}
					onInsertTableColumn={tableOps.handleInsertTableColumn}
					onDeleteTableColumn={tableOps.handleDeleteTableColumn}
					onMergeCellRight={tableOps.handleMergeCellRight}
					onMergeCellDown={tableOps.handleMergeCellDown}
					onMergeSelectedCells={tableOps.handleMergeSelectedCells}
					onSplitCell={tableOps.handleSplitCell}
					onAskAi={
						aiPanel && selectedElement
							? () => {
									aiPanel.askAboutSelection();
									state.setContextMenuState(null);
								}
							: undefined
					}
					onFixAi={
						aiPanel && selectedElement
							? () => {
									aiPanel.fixSelection();
									state.setContextMenuState(null);
								}
							: undefined
					}
					onClose={() => state.setContextMenuState(null)}
				/>
			)}

			{state.canvasContextMenuState && (
				<CanvasContextMenu
					slideIndex={activeSlideIndex}
					canvasContextMenuState={state.canvasContextMenuState}
					mode={mode}
					hasClipboard={Boolean(state.clipboardPayload)}
					showGrid={state.showGrid}
					showRulers={state.showRulers}
					onPaste={() => manipulation.handlePaste()}
					onOpenLayoutGallery={() => {
						const pos = state.canvasContextMenuState;
						if (pos) {
							setLayoutGalleryAnchor(pos);
						}
					}}
					onResetSlide={() => {
						const path = resetSlideLayoutPath(activeSlide);
						if (path) {
							onApplyLayout?.(path);
						}
					}}
					onOpenFormatBackground={() => {
						state.setSelectedElementId(null);
						state.setSelectedElementIds([]);
						state.setSidebarPanelMode('properties');
						state.setIsInspectorPaneOpen(true);
					}}
					onToggleGrid={() => state.setShowGrid((v) => !v)}
					onToggleRulers={() => state.setShowRulers((v) => !v)}
					onClose={() => state.setCanvasContextMenuState(null)}
				/>
			)}
		</>
	);
}
