import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	applyChartPartHighlight,
	canDrillDown,
	ensureChartInteractionStyles,
	findChartPartTarget,
	getBarFacePicturePixelSampleVersion,
	resolveChartKind,
	resolveRevealedChartData,
	subscribeBarFacePicturePixelSamples,
	withChartTitle,
} from 'pptx-viewer-shared';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import React, {
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';

import { renderChartElement } from '../../utils';
import { formatAxisValue } from '../../utils/chart-helpers';
import { buildReactChartViewModel } from '../../utils/chart-view-model-render';
import { useChartPartSelection } from '../chart-part-selection';
import { AreaChart3DContext } from './area-chart-3d-context';
import { Area3DChartRenderer } from './Area3DChartRenderer';
import { BarChart3DContext } from './bar-chart-3d-context';
import { Bar3DChartRenderer } from './Bar3DChartRenderer';
import { buildChart3DPartInteraction } from './build-chart3d-part-interaction';
import { LineChart3DContext } from './line-chart-3d-context';
import { Line3DChartRenderer } from './Line3DChartRenderer';
import { PieChart3DContext } from './pie-chart-3d-context';
import { PieChart3DRenderer } from './PieChart3DRenderer';
import { SurfaceChart3DContext } from './surface-chart-3d-context';
import { SurfaceChart3DRenderer } from './SurfaceChart3DRenderer';
import { useChartMarkInteraction } from './use-chart-mark-interaction';

export interface ChartElementViewProps {
	element: ChartPptxElement;
	/** True when the chart is selected and interactive: activates part hit targets. */
	editable: boolean;
	/** Commits a chart-data edit through the normal element-update/history path. */
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	/**
	 * Playback state for the chart. When it carries a staged chart build
	 * (`build.kind === 'chart'`, or the authored-index `chartReveal`), the
	 * chart reveals its series / categories / cells progressively via
	 * {@link resolveRevealedChartData}.
	 */
	animationState?: ElementAnimationState;
}

/**
 * Renders a chart element and, in edit mode, makes its data marks directly
 * manipulable: click a bar/dot/slice to select that series/point (synced with
 * the chart inspector), drag a mark vertically to change its value (cartesian
 * kinds), and double-click the title to edit it in place. The interactive 3D
 * scenes (bar3D/line3D/area3D/pie3D/surface3D) get the same click/drag ->
 * selection/commit wiring via {@link buildChart3DPartInteraction}.
 */
export function ChartElementView({
	element,
	editable,
	onUpdateElement,
	animationState,
}: ChartElementViewProps): React.ReactElement {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const { selection, setSelection } = useChartPartSelection();
	const [titleDraft, setTitleDraft] = useState<string | null>(null);

	const selectedPart = selection?.elementId === element.id ? selection.part : null;
	const canEdit = editable && Boolean(onUpdateElement);

	// Opt-in interactive 3D surface scene (camera orbit/zoom via OrbitControls).
	const use3D = useContext(SurfaceChart3DContext);
	const isSurfaceKind = resolveChartKind(element.chartData?.chartType ?? 'bar') === 'surface';

	// Opt-in interactive 3D bar scene (real box meshes, camera orbit/zoom via OrbitControls).
	const use3DBar = useContext(BarChart3DContext);
	const isBar3DKind = element.chartData?.chartType === 'bar3D';

	// Opt-in interactive 3D line/area scenes (tube path / ribbon meshes, camera orbit/zoom).
	const use3DLine = useContext(LineChart3DContext);
	const isLine3DKind = element.chartData?.chartType === 'line3D';
	const use3DArea = useContext(AreaChart3DContext);
	const isArea3DKind = element.chartData?.chartType === 'area3D';
	// Opt-in interactive 3D pie scene (real wedge meshes, camera orbit/zoom via OrbitControls).
	const use3DPie = useContext(PieChart3DContext);
	const isPie3DKind = element.chartData?.chartType === 'pie3D';

	// An untargeted bar3D extrusion face whose fill is picture-only samples a
	// colour from the picture ASYNCHRONOUSLY (see chart-bar3d-face-picture-
	// sample.ts's module doc for the COM-verified ground truth this
	// reproduces); the view-model builder only ever sees whatever is already
	// cached, so this subscribes to every resolved sample and forces a
	// rebuild once one lands, the same "state flips once the async decode
	// resolves" shape `ColorChangedImage`/`use-color-change-image.ts` already
	// use for `applyColorChange`.
	const barFacePictureSampleVersion = useSyncExternalStore(
		subscribeBarFacePicturePixelSamples,
		getBarFacePicturePixelSampleVersion,
		getBarFacePicturePixelSampleVersion,
	);

	// The drag context comes from the committed data, captured at drag start, so
	// axis ranges do not rescale under the pointer mid-drag.
	const viewModel = useMemo(() => {
		// Referenced (not used) purely so this memo invalidates once a bar3D
		// face-picture colour sample resolves: `buildReactChartViewModel`
		// consults the shared sample cache internally, which this hook has no
		// other way to depend on.
		void barFacePictureSampleVersion;
		return canEdit ? buildReactChartViewModel(element) : null;
		// oxlint-disable-next-line react/memo-dependencies -- see comment above
	}, [canEdit, element, barFacePictureSampleVersion]);

	useEffect(ensureChartInteractionStyles, []);

	// Drop this chart's part selection when it stops being editable (deselected,
	// mode change) so the inspector highlight does not linger.
	//
	// Guarded on `onUpdateElement`, and that guard is load-bearing: the SAME chart
	// element is mounted several times over (the thumbnail rail alone renders one
	// copy per slide), every one of those copies shares this element id, and none
	// of them is editable. Without the guard the read-only copies raced the canvas
	// on every mark click - the canvas set the selection, a rail copy saw
	// `!canEdit && selection.elementId === element.id` and nulled it a render
	// later, so the highlight class was applied and stripped within ~100ms and no
	// mark ever stayed selected. A mount with no way to commit an edit has no
	// business owning (or clearing) the editing selection.
	useEffect(() => {
		if (!onUpdateElement) {
			return;
		}
		if (!canEdit && selection?.elementId === element.id) {
			setSelection(null);
		}
	}, [canEdit, selection, element.id, setSelection, onUpdateElement]);

	// Re-apply the selected-part highlight class after every render: React
	// re-creates the SVG marks on each chart change, dropping DOM-only classes.
	useEffect(() => {
		applyChartPartHighlight(wrapperRef.current, selectedPart);
	});

	const {
		previewData,
		dragValue,
		setDragValue,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
	} = useChartMarkInteraction({
		element,
		canEdit,
		onUpdateElement,
		viewModel,
		wrapperRef,
		setSelection,
	});

	const chart3DInteraction = buildChart3DPartInteraction({
		element,
		canEdit,
		onUpdateElement,
		selection,
		setSelection,
		setDragValue,
	});

	const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		// G8: `a:graphicFrameLocks/@noDrilldown` forbids entering this chart's
		// individual parts (title, series, data points) for editing.
		if (!canEdit || !canDrillDown(element)) {
			return;
		}
		const target = e.target as Partial<Element>;
		if (typeof target.closest !== 'function') {
			return;
		}
		if ((target as Element).closest("[data-chart-part='title']")) {
			e.stopPropagation();
			setTitleDraft(element.chartData?.title ?? '');
			return;
		}
		if (findChartPartTarget(e.target)) {
			// A mark double-click is already handled as two selects; keep it from
			// bubbling into the element-level inline-text-edit handler.
			e.stopPropagation();
		}
	};

	const commitTitle = () => {
		if (titleDraft !== null && element.chartData && onUpdateElement) {
			onUpdateElement({
				chartData: withChartTitle(element.chartData, titleDraft),
			} as Partial<PptxElement>);
		}
		setTitleDraft(null);
	};

	// Base chart data (a live drag preview wins over the committed data), then the
	// staged-build reveal trims it to the stages shown at the current progress.
	const baseChartData = previewData ?? element.chartData;
	const revealedChartData = baseChartData
		? resolveRevealedChartData(baseChartData, animationState)
		: baseChartData;
	const renderedElement: ChartPptxElement =
		revealedChartData === element.chartData
			? element
			: { ...element, chartData: revealedChartData };

	return (
		<div
			ref={wrapperRef}
			className={`relative w-full h-full ${canEdit ? 'pptx-chart-interactive' : ''}`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onDoubleClick={handleDoubleClick}
		>
			{use3D && isSurfaceKind ? (
				<SurfaceChart3DRenderer
					element={renderedElement}
					interaction={chart3DInteraction}
					selectedPart={selectedPart}
					textStyle={animationState?.textStyle}
				/>
			) : use3DBar && isBar3DKind ? (
				<Bar3DChartRenderer
					element={renderedElement}
					interaction={chart3DInteraction}
					selectedPart={selectedPart}
					textStyle={animationState?.textStyle}
				/>
			) : use3DLine && isLine3DKind ? (
				<Line3DChartRenderer
					element={renderedElement}
					interaction={chart3DInteraction}
					selectedPart={selectedPart}
					textStyle={animationState?.textStyle}
				/>
			) : use3DArea && isArea3DKind ? (
				<Area3DChartRenderer
					element={renderedElement}
					interaction={chart3DInteraction}
					selectedPart={selectedPart}
					textStyle={animationState?.textStyle}
				/>
			) : use3DPie && isPie3DKind ? (
				<PieChart3DRenderer
					element={renderedElement}
					interaction={chart3DInteraction}
					selectedPart={selectedPart}
				/>
			) : (
				renderChartElement(renderedElement)
			)}
			{dragValue !== null && (
				<div className='absolute top-1 right-1 z-10 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white pointer-events-none'>
					{formatAxisValue(dragValue)}
				</div>
			)}
			{titleDraft !== null && (
				<input
					type='text'
					autoFocus
					value={titleDraft}
					className='absolute left-1/2 top-0.5 z-10 w-3/5 -translate-x-1/2 rounded border border-border bg-background px-1 py-0.5 text-center text-[11px] text-foreground shadow'
					onChange={(e) => setTitleDraft(e.target.value)}
					onPointerDown={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							commitTitle();
						} else if (e.key === 'Escape') {
							setTitleDraft(null);
						}
						e.stopPropagation();
					}}
					onBlur={commitTitle}
				/>
			)}
		</div>
	);
}
