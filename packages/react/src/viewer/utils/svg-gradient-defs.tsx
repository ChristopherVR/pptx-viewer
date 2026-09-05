/**
 * React view of a shared {@link SvgGradientDef}: the `<defs>` paint server a
 * vector shape's fill or stroke references via `svgGradientFillRef`.
 *
 * The decision of WHICH paint server to emit (linear, elliptical radial, or
 * the nested-rectangle-band tile for a freeform `a:path type="rect"`
 * gradient) is made in shared; this only maps each descriptor to JSX.
 */
import type { SvgGradientDef } from 'pptx-viewer-shared';
import React from 'react';

export function renderSvgGradientDefs(gradient: SvgGradientDef | undefined): React.ReactNode {
	if (!gradient) {
		return null;
	}
	if (gradient.kind === 'rectPath') {
		return (
			<defs>
				<pattern id={gradient.id} patternUnits='objectBoundingBox' width={1} height={1}>
					<image href={gradient.href} x={0} y={0} width={1} height={1} preserveAspectRatio='none' />
				</pattern>
			</defs>
		);
	}
	const stops = gradient.stops.map((stop, index) => (
		<stop
			key={index}
			offset={stop.offset}
			stopColor={stop.color}
			stopOpacity={typeof stop.opacity === 'number' ? stop.opacity : undefined}
		/>
	));
	return (
		<defs>
			{gradient.kind === 'radial' ? (
				<radialGradient id={gradient.id} cx={gradient.cx} cy={gradient.cy} r={gradient.r}>
					{stops}
				</radialGradient>
			) : (
				<linearGradient
					id={gradient.id}
					x1={gradient.x1}
					y1={gradient.y1}
					x2={gradient.x2}
					y2={gradient.y2}
				>
					{stops}
				</linearGradient>
			)}
		</defs>
	);
}
