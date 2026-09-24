import type { PptxElement } from 'pptx-viewer-core';
import { getCachedNativeImageSize, probeNativeImageSize } from 'pptx-viewer-shared';
/**
 * React component that renders an `a:blipFill/a:tile` repeating texture.
 *
 * Per ECMA-376 §20.1.8.58, the tile's `@sx`/`@sy` scale is a percentage of
 * the picture's own NATIVE pixel size, not of the box painting it, so a CSS
 * `background-size: <percent>` (which resolves against the container) is the
 * wrong reference frame. This component probes the source's native size (see
 * `pptx-viewer-shared`'s `image-native-size`) and re-renders once with an
 * absolute-pixel `backgroundSize` when it resolves; until then (or if the
 * probe fails) it falls back to the previous container-relative percentage
 * so nothing regresses.
 */
import React, { useEffect, useState } from 'react';

import { getImageTilingStyle } from '../utils';

interface TiledImageLayerProps {
	element: PptxElement;
	src: string;
	className?: string;
	style?: React.CSSProperties;
}

export function TiledImageLayer({
	element,
	src,
	className,
	style,
}: TiledImageLayerProps): React.ReactElement {
	const [nativeSize, setNativeSize] = useState(() => getCachedNativeImageSize(src));

	useEffect(() => {
		const cached = getCachedNativeImageSize(src);
		if (cached) {
			setNativeSize(cached);
			return;
		}
		let cancelled = false;
		probeNativeImageSize(src)
			.then((size) => {
				if (!cancelled && size) {
					setNativeSize(size);
				}
				return undefined;
			})
			.catch(() => {
				// Fall back to the container-relative percentage already in use.
			});
		return () => {
			cancelled = true;
		};
	}, [src]);

	return (
		<div className={className} style={{ ...getImageTilingStyle(element, nativeSize), ...style }} />
	);
}
