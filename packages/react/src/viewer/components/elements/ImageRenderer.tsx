import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import { getImageColorWashStyle, getImageSvgFilters } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import {
	getDuotoneColors,
	getImageEffectsFilter,
	getImageTilingStyle,
	isImageTiled,
} from '../../utils';
import { ColorChangedImage } from '../ColorChangedImage';
import { DuotoneImage } from '../DuotoneImage';

function renderImageEffectDefinitions(
	element: PptxElement,
	excludeDuotone = false,
): React.ReactNode {
	return getImageSvgFilters(element)
		.filter((definition) => !excludeDuotone || definition.id !== `duotone-${element.id}`)
		.map((definition) => (
			<svg
				key={definition.id}
				width={0}
				height={0}
				style={{ position: 'absolute', overflow: 'hidden' }}
				aria-hidden='true'
			>
				<defs>
					<filter
						id={definition.id}
						colorInterpolationFilters='sRGB'
						dangerouslySetInnerHTML={{ __html: definition.markup }}
					/>
				</defs>
			</svg>
		));
}

export function imgSrc(el: PptxElement): string | undefined {
	// Prefer SVG variant over raster fallback when available
	if ('svgData' in el && (el as { svgData?: string }).svgData) {
		return (el as { svgData?: string }).svgData;
	}
	return 'imageData' in el ? (el as { imageData?: string }).imageData : undefined;
}

export function renderImg(
	el: PptxElement,
	style: React.CSSProperties,
	filter: string | undefined,
	alt: string,
	opacity?: number,
) {
	const src = imgSrc(el);
	if (!src) {
		// Check for metafile images (EMF/WMF) that couldn't be converted
		const imagePath = 'imagePath' in el ? (el as { imagePath?: string }).imagePath : undefined;
		if (imagePath) {
			const ext = imagePath.split('.').pop()?.toLowerCase();
			if (ext === 'emf' || ext === 'wmf') {
				return (
					<div className='w-full h-full flex flex-col items-center justify-center text-[11px] text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							width='24'
							height='24'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='1.5'
							strokeLinecap='round'
							strokeLinejoin='round'
							className='mb-1 text-gray-300'
						>
							<rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
							<circle cx='8.5' cy='8.5' r='1.5' />
							<polyline points='21 15 16 10 5 21' />
						</svg>
						<span>{ext.toUpperCase()} metafile</span>
					</div>
				);
			}
		}
		return (
			<div className='w-full h-full flex items-center justify-center text-[11px] text-gray-500 bg-gray-100'>
				{translationsEn['pptx.elementType.image']}
			</div>
		);
	}
	const effectStyles: React.CSSProperties = {
		...(filter ? { filter } : {}),
		...(opacity !== undefined ? { opacity } : {}),
	};

	if (isImageTiled(el)) {
		const tileSrc = imgSrc(el);
		if (!tileSrc) {
			return (
				<div className='w-full h-full flex items-center justify-center text-[11px] text-gray-500 bg-gray-100'>
					Image
				</div>
			);
		}
		return (
			<>
				{renderImageEffectDefinitions(el)}
				<div
					className='pointer-events-none select-none w-full h-full'
					style={{ ...getImageTilingStyle(el), ...effectStyles }}
				/>
			</>
		);
	}
	const colorWash = getImageColorWashStyle(
		isImageLikeElement(el) ? el.imageEffects?.colorWash : undefined,
	);
	// Colour-change effect (chroma-key via canvas pixel replacement)
	const clrChange =
		'imageEffects' in el
			? (
					el as unknown as {
						imageEffects?: {
							clrChange?: {
								clrFrom: string;
								clrTo: string;
								clrToTransparent?: boolean;
							};
						};
					}
				).imageEffects?.clrChange
			: undefined;
	const duotoneColors = getDuotoneColors(el);
	// When duotone is present and no clrChange, use canvas-based DuotoneImage
	// which gives true per-pixel luminance mapping. Exclude duotone from the CSS
	// filter string since canvas handles it.
	const useDuotoneCanvas = Boolean(duotoneColors && !clrChange);
	const filterForImg = useDuotoneCanvas
		? getImageEffectsFilter(el, { excludeDuotone: true })
		: filter;
	const canvasEffectStyles: React.CSSProperties = {
		...(filterForImg ? { filter: filterForImg } : {}),
		...(opacity !== undefined ? { opacity } : {}),
	};
	return (
		<>
			{renderImageEffectDefinitions(el, useDuotoneCanvas)}
			{useDuotoneCanvas && duotoneColors ? (
				<DuotoneImage
					src={src}
					duotone={duotoneColors}
					alt={alt}
					className='pointer-events-none select-none'
					style={{ ...style, ...canvasEffectStyles }}
				/>
			) : clrChange ? (
				<ColorChangedImage
					src={src}
					clrChange={clrChange}
					alt={alt}
					className='pointer-events-none select-none'
					style={{ ...style, ...effectStyles }}
				/>
			) : (
				<img
					src={src}
					alt={alt}
					className='pointer-events-none select-none'
					style={{ ...style, ...effectStyles }}
					draggable={false}
					onError={(e) => {
						e.currentTarget.style.display = 'none';
					}}
				/>
			)}
			{colorWash && (
				<div
					className='pointer-events-none absolute inset-0'
					style={{
						backgroundColor: colorWash.backgroundColor,
						opacity: colorWash.opacity,
					}}
				/>
			)}
		</>
	);
}
