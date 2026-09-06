import type { GroupPptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	getAriaLabel,
	getAriaRoleDescription,
	getGroupChildParentFill,
	isElementRendered,
} from 'pptx-viewer-shared';
import React from 'react';

import {
	getElementTransform,
	getImageEffectsFilter,
	getImageEffectsOpacity,
	getImageRenderStyle,
	isEditableTextElement,
	renderVectorShape,
} from '../utils';
import { renderBody } from './elements/ElementBody';
import { ShapeEffectOverlay } from './elements/ShapeEffectOverlay';
import type { StaticElementRendererProps } from './static-element-renderer-types';
import {
	getStaticElementInteractionState,
	getStaticElementVisualState,
	getStaticElementWrapperClassName,
} from './static-element-renderer-utils';

export type { StaticElementRendererProps };

const noop = (): void => {};
const EMPTY_MEDIA_DATA_URLS = new Map<string, string>();

function StaticElementRendererImpl({
	element,
	activeSlide,
	allSlides,
	mediaDataUrls = EMPTY_MEDIA_DATA_URLS,
	sourceSlideIndex,
	zIndex,
	positioned = true,
	fieldContext,
	tableStyleContext,
	parentGroupFill,
	onActionClick,
	actionRequiresModifier = false,
	animation,
	imageAnimation,
	exposeElementId = false,
	suppressReflection = false,
}: StaticElementRendererProps): React.ReactElement | null {
	// Selection-Pane-hidden elements are not drawn on any surface, so the static
	// path (thumbnails, presenter previews, transition ghosts, export rasters)
	// skips them too. This function holds no hooks, so the guard can lead.
	if (!isElementRendered(element)) {
		return null;
	}
	const {
		hasFill,
		fill,
		strokeWidth,
		stroke,
		visualStyle,
		textStyle,
		isImage,
		letsTextOverflow,
		isCallout,
	} = getStaticElementVisualState(element, parentGroupFill);
	const { action, isActionable, contractRole } = getStaticElementInteractionState(
		element,
		Boolean(onActionClick),
		exposeElementId,
	);

	return (
		<div
			data-static-element-type={element.type}
			data-element-id={exposeElementId ? element.id : undefined}
			// The neutral element marker belongs on the same nodes as the rest of
			// the contract. A live-stage group child already carries the id, the
			// role, the accessible name and `data-pptx-action`, so withholding just
			// this attribute made React advertise 28 elements on a slide where the
			// other four bindings advertised 33 - the same DOM, counted differently.
			// It is not a selection key (a click on a child resolves UP to the group
			// via `resolveTopLevelElementId`, which walks `data-element-id`), so
			// marking children cannot change what a click selects.
			data-pptx-element={exposeElementId ? 'true' : undefined}
			data-pptx-action={isActionable ? 'click' : undefined}
			className={getStaticElementWrapperClassName(
				element,
				{ isImage, letsTextOverflow, isCallout },
				positioned,
				isActionable,
			)}
			role={contractRole}
			aria-label={exposeElementId ? getAriaLabel(element) : undefined}
			aria-roledescription={exposeElementId ? getAriaRoleDescription(element) : undefined}
			tabIndex={isActionable ? 0 : undefined}
			title={isActionable ? action?.tooltip || action?.url || undefined : undefined}
			onClick={
				isActionable
					? (event) => {
							if (actionRequiresModifier && !event.ctrlKey && !event.metaKey) {
								return;
							}
							event.stopPropagation();
							event.preventDefault();
							onActionClick?.(element.id, action!);
						}
					: undefined
			}
			onKeyDown={
				isActionable
					? (event) => {
							if (event.key !== 'Enter' && event.key !== ' ') {
								return;
							}
							event.preventDefault();
							event.stopPropagation();
							onActionClick?.(element.id, action!);
						}
					: undefined
			}
			style={{
				left: positioned ? element.x : undefined,
				top: positioned ? element.y : undefined,
				width: positioned ? Math.max(element.width, 1) : '100%',
				height: positioned ? Math.max(element.height, 1) : '100%',
				transform: positioned ? getElementTransform(element) : undefined,
				transformOrigin: 'center',
				zIndex,
				...visualStyle,
				...(isImage
					? {
							backgroundColor: 'transparent',
							backgroundImage: undefined,
							backgroundRepeat: undefined,
							backgroundSize: undefined,
							backgroundPosition: undefined,
							borderRadius: undefined,
							clipPath: undefined,
							overflow: 'visible',
						}
					: {}),
				animation,
			}}
		>
			{/* Soft-edge <filter> defs + DAG fill-overlay tint layer + (unless
			    suppressed) this element's own reflection mirror. */}
			<ShapeEffectOverlay element={element} suppressReflection={suppressReflection} />
			{element.type === 'group' ? (
				<div className='relative w-full h-full'>
					{((element as GroupPptxElement).children ?? []).map((child, index) => (
						<StaticElementRenderer
							key={child.id}
							element={child}
							activeSlide={activeSlide}
							allSlides={allSlides}
							mediaDataUrls={mediaDataUrls}
							sourceSlideIndex={sourceSlideIndex}
							zIndex={index}
							fieldContext={fieldContext}
							tableStyleContext={tableStyleContext}
							// Chained, not just this group's own fill: `a:grpFill` resolves
							// against the nearest ANCESTOR that has one, so a nested group
							// without a fill of its own passes its parent's straight down.
							parentGroupFill={getGroupChildParentFill(element, parentGroupFill)}
							onActionClick={onActionClick}
							actionRequiresModifier={actionRequiresModifier}
							exposeElementId={exposeElementId}
							// NOT `suppressReflection`: a child is not the element being
							// mirrored, so its own reflection (if it has one) must still
							// render inside this group's mirror. See the prop doc above.
						/>
					))}
				</div>
			) : (
				renderBody({
					el: element,
					isImg: isImage,
					isEditing: false,
					editText: '',
					spellCheck: false,
					txtSE: hasTextProperties(element) ? element.textStyle : undefined,
					txtS: textStyle,
					vecShape: renderVectorShape(
						element,
						isImage ? false : hasFill,
						fill,
						strokeWidth,
						stroke,
					),
					imgStyle: imageAnimation
						? { ...getImageRenderStyle(element), animation: imageAnimation }
						: getImageRenderStyle(element),
					imgFilter: getImageEffectsFilter(element),
					imgOpacity: getImageEffectsOpacity(element),
					imgAlt: '',
					isTxtEl: isEditableTextElement(element),
					media: mediaDataUrls,
					tableSt: null,
					isSel: false,
					doInk: true,
					doGrp: false,
					onEditChange: noop,
					onCommit: noop,
					onCancel: noop,
					isPresentationPassive: false,
					// This renderer only ever paints a STILL of a slide (presenter
					// console panes, thumbnails, previews). It is not in presentation
					// mode, so without saying so a video here would carry Chrome's
					// scrubber over a slide nobody can play.
					isStaticSurface: true,
					placeholderPromptMode: 'thumbnail',
					slideElements: activeSlide?.elements,
					allSlides,
					sourceSlideIndex,
					fieldContext,
					tableStyleContext,
					canEditSmartArt: false,
					canEditChart: false,
				})
			)}
		</div>
	);
}

/**
 * Read-only element dispatcher shared by previews, thumbnails, and groups.
 *
 * Memoized: a themed background group can hold dozens of static freeform
 * shapes (per slide and per thumbnail), and every element is a stable parsed
 * object, so re-renders driven by zoom, slide navigation, or presentation
 * state must not re-render the whole subtree. The recursion above references
 * this memoized export so nested group children stay memoized too.
 */
export const StaticElementRenderer = React.memo(StaticElementRendererImpl);
StaticElementRenderer.displayName = 'StaticElementRenderer';
