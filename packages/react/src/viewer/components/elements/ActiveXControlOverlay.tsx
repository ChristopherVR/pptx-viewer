/**
 * ActiveX control overlay.
 *
 * ActiveX controls (`p:controls > p:control`) are preserved on
 * `slide.activeXControls` but cannot run inside a viewer. This overlay draws
 * each control's static fallback picture when one was resolved, otherwise a
 * labelled placeholder badge, so the slide shows where the control lives
 * instead of a blank gap.
 *
 * The geometry/label/fallback-image decision lives in
 * `pptx-viewer-shared`'s `getActiveXControlOverlayView` (this was the
 * React-only implementation it was extracted from) so Vue, Angular, Svelte
 * and Vanilla agree on where and how a control is drawn; this component only
 * maps the returned view onto JSX.
 */
import type { PptxActiveXControl } from 'pptx-viewer-core';
import { getActiveXControlOverlayView } from 'pptx-viewer-shared';

import type { CanvasSize } from '../../types';

/**
 * View of an ActiveX control including the fallback-picture geometry and
 * relationship id parsed in core. Declared locally so the overlay typechecks
 * against any published `pptx-viewer-core` types (the fields are additive and
 * optional); at runtime the loader supplies them.
 */
interface ActiveXControlView extends PptxActiveXControl {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	fallbackImageRelId?: string;
}

interface ActiveXControlOverlayProps {
	controls: ActiveXControlView[];
	canvasSize: CanvasSize;
	/**
	 * Optional resolver mapping a control's `fallbackImageRelId` to an image
	 * data URL. When it returns a URL the static preview is shown in place of
	 * the placeholder badge.
	 */
	resolveFallbackImage?: (relId: string) => string | undefined;
}

export function ActiveXControlOverlay({
	controls,
	canvasSize,
	resolveFallbackImage,
}: ActiveXControlOverlayProps) {
	if (controls.length === 0) {
		return null;
	}

	return (
		<div className='absolute inset-0 pointer-events-none z-[40]' data-testid='pptx-activex-overlay'>
			{controls.map((control, idx) => {
				const view = getActiveXControlOverlayView(control, canvasSize, idx, resolveFallbackImage);

				if (view.className === 'image' && view.imageUrl) {
					return (
						<img
							key={`${control.relId}-${idx}`}
							src={view.imageUrl}
							alt={view.label}
							title={`ActiveX control: ${view.label}`}
							className='absolute'
							style={{ left: view.left, top: view.top, width: view.width, height: view.height }}
						/>
					);
				}

				return (
					<div
						key={`${control.relId}-${idx}`}
						className='absolute'
						title={`ActiveX control: ${view.label} (interactive controls are not supported in the viewer)`}
						style={{
							left: view.left,
							top: view.top,
							width: view.width,
							height: view.height,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 6,
							padding: '2px 6px',
							boxSizing: 'border-box',
							border: '1px dashed rgba(100, 116, 139, 0.8)',
							borderRadius: 4,
							background: 'rgba(148, 163, 184, 0.14)',
							color: 'rgb(51, 65, 85)',
							fontSize: 11,
							fontWeight: 600,
							lineHeight: 1.2,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						<span aria-hidden='true'>&#9881;</span>
						<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.label}</span>
					</div>
				);
			})}
		</div>
	);
}
