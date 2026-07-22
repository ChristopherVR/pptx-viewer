/**
 * ActiveX control overlay.
 *
 * ActiveX controls (`p:controls > p:control`) are preserved on
 * `slide.activeXControls` but cannot run inside a viewer. Historically they
 * rendered as nothing at all. This overlay draws each control's static
 * fallback picture when one was resolved, otherwise a labelled placeholder
 * badge, so the slide shows where the control lives instead of a blank gap.
 *
 * The control's geometry (`x/y/width/height`, px) comes from the
 * `mc:AlternateContent > mc:Fallback > p:pic` preview parsed in core. Controls
 * without a fallback picture have no geometry and are pinned to the top-left.
 */
import type { PptxActiveXControl } from 'pptx-viewer-core';

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

const PLACEHOLDER_WIDTH = 120;
const PLACEHOLDER_HEIGHT = 40;

export function ActiveXControlOverlay({
	controls,
	canvasSize,
	resolveFallbackImage,
}: ActiveXControlOverlayProps) {
	if (controls.length === 0) {
		return null;
	}

	return (
		<div className='absolute inset-0 pointer-events-none z-[40]'>
			{controls.map((control, idx) => {
				const width = control.width ?? PLACEHOLDER_WIDTH;
				const height = control.height ?? PLACEHOLDER_HEIGHT;
				const left = control.x ?? 8;
				const top = control.y ?? 8 + idx * (PLACEHOLDER_HEIGHT + 6);
				const clampedWidth = Math.min(width, canvasSize.width);
				const clampedHeight = Math.min(height, canvasSize.height);
				const imageUrl = control.fallbackImageRelId
					? resolveFallbackImage?.(control.fallbackImageRelId)
					: undefined;
				const label = control.name || 'ActiveX control';

				if (imageUrl) {
					return (
						<img
							key={`${control.relId}-${idx}`}
							src={imageUrl}
							alt={label}
							title={`ActiveX control: ${label}`}
							className='absolute'
							style={{ left, top, width: clampedWidth, height: clampedHeight }}
						/>
					);
				}

				return (
					<div
						key={`${control.relId}-${idx}`}
						className='absolute'
						title={`ActiveX control: ${label} (interactive controls are not supported in the viewer)`}
						style={{
							left,
							top,
							width: clampedWidth,
							height: clampedHeight,
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
						<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
					</div>
				);
			})}
		</div>
	);
}
