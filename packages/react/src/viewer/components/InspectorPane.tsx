import { hasTextProperties } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useSheetDismissDrag } from '../hooks/useSheetDismissDrag';
import { cn } from '../utils';
import { AnimationPanel } from './inspector/AnimationPanel';
import { ElementInspectorBody } from './inspector/ElementInspectorBody';
// Extracted inspector modules
import { HEADING } from './inspector/inspector-pane-constants';
import type { InspectorPaneProps } from './inspector/inspector-pane-types';
import { InspectorCommentsSection } from './inspector/InspectorCommentsSection';
import { InspectorPaneHeader } from './inspector/InspectorPaneHeader';
import { PresentationPropertiesPanel } from './inspector/PresentationPropertiesPanel';
import { SlideBackgroundPanel } from './inspector/SlideBackgroundPanel';
import { useInspectorPaneState } from './inspector/useInspectorPaneState';
import { ResizeHandle } from './ResizeHandle';

// ---------------------------------------------------------------------------
// Main Inspector Pane (thin shell, delegates to extracted sub-panels)
// ---------------------------------------------------------------------------

export function InspectorPane(props: InspectorPaneProps): React.ReactElement {
	const {
		isOpen,
		canEdit,
		activeSlide,
		slides,
		canvasSize,
		selectedElement,
		selectedElementIds,
		tableEditorState,
		activeTab,
		onSetActiveTab,
		onClose,
		onUpdateElement,
		onSelectElement,
		onMoveLayer,
		presentationProperties,
		onUpdatePresentationProperties,
		notesMaster,
		handoutMaster,
		notesCanvasSize,
		coreProperties,
		appProperties,
		customProperties,
		themeOptions,
		onUpdateCoreProperties,
		onUpdateAppProperties,
		onUpdateCustomProperties,
		tagCollections,
		onUpdateTagCollections,
		onApplyTheme,
		comments,
		commentDraft,
		editingCommentId,
		commentEditDraft,
		onSetCommentDraft,
		onAddComment,
		onDeleteComment,
		onStartEditComment,
		onSaveEditComment,
		onCancelEditComment,
		onSetCommentEditDraft,
		onToggleCommentResolved,
		onStartReply,
		onCancelReply,
		onReplyDraftChange,
		onSubmitReply,
		replyingToCommentId,
		replyDraftByCommentId,
		onUpdateCanvasSize,
		onUpdateElementStyle,
		onUpdateTextStyle,
		onUpdateSlide,
		editTemplateMode,
		slideMasters,
		onSetTemplateBackground,
		onGetTemplateBackgroundColor,
		mediaDataUrls,
		theme,
		panelWidth,
	} = props;
	const hasSelection = selectedElement !== null;
	const { t } = useTranslation();

	// Swipe-down-to-dismiss for the mobile bottom-sheet presentation. The grab
	// region is `md:hidden`, so `dragY` only ever moves on mobile: the inline
	// transform below is therefore a no-op on desktop where this is a side panel.
	const { dragY, handlers: dragHandlers } = useSheetDismissDrag(onClose);

	const {
		animationPanelHeight,
		effectiveThemeOptions,
		onResizeAnimationPanel,
		selectedThemePath,
		setSelectedThemePath,
	} = useInspectorPaneState(themeOptions, slideMasters, theme);

	return (
		<>
			{/* Mobile backdrop: tap to dismiss the bottom sheet. */}
			{isOpen && (
				<button
					type='button'
					aria-label={t('common.close')}
					onClick={onClose}
					className='md:hidden fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150'
				/>
			)}
			<div
				className={cn(
					// Shared styles
					'bg-background flex flex-col text-xs text-foreground shadow-xl',
					// Mobile: absolute bottom sheet overlay sized via dvh so it
					// adapts to the on-screen keyboard / dynamic browser chrome.
					'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-h-[75dvh] max-md:rounded-t-2xl max-md:border-t max-md:border-border max-md:z-30 max-md:pb-[max(env(safe-area-inset-bottom),0px)]',
					'max-md:transition-transform max-md:duration-200 max-md:ease-in-out',
					isOpen ? 'max-md:translate-y-0' : 'max-md:translate-y-full',
					// Desktop: flow-based flex child (takes space from canvas)
					'md:h-full md:border-l md:border-border',
					!panelWidth && 'md:w-72',
				)}
				style={{
					...(panelWidth ? { width: panelWidth } : {}),
					...(dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {}),
				}}
			>
				{/* Mobile drag handle: swipe down past the threshold to dismiss. */}
				<div
					className='md:hidden flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none'
					onPointerDown={dragHandlers.onPointerDown}
					onPointerMove={dragHandlers.onPointerMove}
					onPointerUp={dragHandlers.onPointerUp}
					onPointerCancel={dragHandlers.onPointerCancel}
				>
					<div className='h-1 w-10 rounded-full bg-muted-foreground/40' />
				</div>

				<InspectorPaneHeader
					activeTab={activeTab}
					onSetActiveTab={onSetActiveTab}
					onClose={onClose}
				/>

				{/* Tab content */}
				<div className='flex-1 overflow-y-auto p-3 space-y-3'>
					{/* ── Elements ── */}
					{activeTab === 'elements' && (
						<div className='space-y-1'>
							<div className={cn(HEADING, 'mb-2')}>{t('pptx.inspector.layerOrder')}</div>
							{activeSlide ? (
								[...(activeSlide.elements || [])].reverse().map((el, ri) => {
									const idx = (activeSlide.elements || []).length - 1 - ri;
									const sel = selectedElement?.id === el.id || selectedElementIds.includes(el.id);
									const label =
										(hasTextProperties(el) ? (el.text || '').slice(0, 24) : undefined) || el.type;
									return (
										<div
											key={el.id}
											title={`${el.type} — ${el.id}`}
											className={cn(
												'flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors',
												sel ? 'bg-primary/30 text-primary' : 'hover:bg-muted text-foreground',
											)}
											onClick={() => onSelectElement(el.id)}
										>
											<span className='text-muted-foreground w-4 text-right'>{idx + 1}</span>
											<span className='flex-1 truncate'>{label}</span>
										</div>
									);
								})
							) : (
								<div className='text-muted-foreground italic'>
									{t('pptx.inspector.noSlideSelected')}
								</div>
							)}
						</div>
					)}

					{/* ── Properties ── */}
					{activeTab === 'properties' && (
						<div className='space-y-3'>
							{hasSelection && selectedElement ? (
								<ElementInspectorBody
									selectedElement={selectedElement}
									canEdit={canEdit}
									slides={slides}
									tableEditorState={tableEditorState}
									mediaDataUrls={mediaDataUrls}
									onUpdateElement={onUpdateElement}
									onUpdateElementStyle={onUpdateElementStyle}
									onUpdateTextStyle={onUpdateTextStyle}
									onMoveLayer={onMoveLayer}
								/>
							) : (
								<>
									<PresentationPropertiesPanel
										canEdit={canEdit}
										canvasSize={canvasSize}
										presentationProperties={presentationProperties}
										onUpdatePresentationProperties={onUpdatePresentationProperties}
										notesMaster={notesMaster}
										handoutMaster={handoutMaster}
										notesCanvasSize={notesCanvasSize}
										coreProperties={coreProperties}
										appProperties={appProperties}
										customProperties={customProperties}
										themeOptions={effectiveThemeOptions}
										selectedThemePath={selectedThemePath}
										setSelectedThemePath={setSelectedThemePath}
										onApplyTheme={onApplyTheme}
										onUpdateCoreProperties={onUpdateCoreProperties}
										onUpdateAppProperties={onUpdateAppProperties}
										onUpdateCustomProperties={onUpdateCustomProperties}
										tagCollections={tagCollections}
										onUpdateTagCollections={onUpdateTagCollections}
										onUpdateCanvasSize={onUpdateCanvasSize}
										activeSlide={activeSlide}
										theme={theme}
										onUpdateSlide={onUpdateSlide}
									/>

									{activeSlide && (
										<SlideBackgroundPanel
											activeSlide={activeSlide}
											canEdit={canEdit}
											onUpdateSlide={onUpdateSlide}
											editTemplateMode={editTemplateMode}
											slideMasters={slideMasters}
											onSetTemplateBackground={onSetTemplateBackground}
											onGetTemplateBackgroundColor={onGetTemplateBackgroundColor}
										/>
									)}
								</>
							)}
						</div>
					)}

					{/* ── Comments ── */}
					{activeTab === 'comments' && (
						<InspectorCommentsSection
							comments={comments}
							canEdit={canEdit}
							activeSlide={activeSlide}
							selectedElement={selectedElement}
							editingCommentId={editingCommentId}
							commentEditDraft={commentEditDraft}
							commentDraft={commentDraft}
							replyingToCommentId={replyingToCommentId ?? null}
							replyDraftByCommentId={replyDraftByCommentId ?? {}}
							onSetCommentDraft={onSetCommentDraft}
							onAddComment={onAddComment}
							onDeleteComment={onDeleteComment}
							onStartEditComment={onStartEditComment}
							onSaveEditComment={onSaveEditComment}
							onCancelEditComment={onCancelEditComment}
							onSetCommentEditDraft={onSetCommentEditDraft}
							onToggleCommentResolved={onToggleCommentResolved}
							onStartReply={onStartReply}
							onCancelReply={onCancelReply}
							onReplyDraftChange={onReplyDraftChange}
							onSubmitReply={onSubmitReply}
							onSelectElement={onSelectElement}
						/>
					)}
				</div>

				{/* Animation panel: always visible at bottom when element selected */}
				{hasSelection && selectedElement && activeSlide && (
					<>
						<ResizeHandle direction='vertical' onResize={onResizeAnimationPanel} />
						<div
							className='border-t border-border p-3 overflow-y-auto flex-shrink-0'
							style={{ height: animationPanelHeight }}
						>
							<AnimationPanel
								selectedElement={selectedElement}
								activeSlide={activeSlide}
								canEdit={canEdit}
								onUpdateSlide={onUpdateSlide}
							/>
						</div>
					</>
				)}
			</div>
		</>
	);
}
