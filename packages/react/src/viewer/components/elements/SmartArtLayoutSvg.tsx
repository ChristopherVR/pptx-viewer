import type { RenderedConnector, RenderedNode, SmartArtLayoutResult } from 'pptx-viewer-shared';
import React from 'react';

import { smartArtNodeGroupProps, SmartArtNodeText } from './smartart-renderer-utils';

/**
 * Renders a {@link SmartArtLayoutResult} - the framework-neutral descriptor the
 * shared DiagramML interpreter / family engine returns - as SVG.
 *
 * This is the React half of the same contract Vue's `SmartArtRenderer.vue`,
 * Angular's `smart-art-renderer.component.ts`, Svelte's `smartart-view.ts` and
 * Vanilla's `render/elements/smartart.ts` render, so all five bindings draw the
 * same diagram from the same geometry. It contains no layout maths of its own:
 * every coordinate, colour and font size arrives already decided.
 *
 * Each node group carries `data-smartart-node-id` so
 * {@link ../SmartArtEditableLayer} can map a double-click back to a model node,
 * plus `role="img"` + `aria-label` + `<title>` from the shared a11y view-model.
 */

/** Binding defaults for the optional connector paint fields. */
const CONNECTOR_STROKE = '#94a3b8';
const CONNECTOR_WIDTH = 1.5;
const CONNECTOR_OPACITY = 0.5;

/** Default label colour when a node carries no `fontColor` override. */
const DEFAULT_LABEL_COLOR = 'white';

interface SmartArtLayoutSvgProps {
	/** Geometry from `computeSmartArtLayout`. */
	layout: SmartArtLayoutResult;
	/**
	 * Source node ids in render order (flattened depth-first), index-aligned
	 * with `layout.nodes`. Drives inline editing and per-node accessibility.
	 */
	nodeIds: string[];
	/** Per-node accessibility labels, keyed by node id. */
	nodeLabels?: Map<string, string>;
}

/** One connector path, applying the descriptor's paint or the binding default. */
function ConnectorPath({ connector }: { connector: RenderedConnector }): React.ReactElement {
	return (
		<path
			d={connector.d}
			fill='none'
			stroke={connector.stroke ?? CONNECTOR_STROKE}
			strokeWidth={connector.strokeWidth ?? CONNECTOR_WIDTH}
			opacity={connector.opacity ?? CONNECTOR_OPACITY}
			strokeDasharray={connector.dash}
		/>
	);
}

/** The filled shape for one rendered node (no text). */
function NodeShape({ node }: { node: RenderedNode }): React.ReactElement {
	if (node.kind === 'circle') {
		return (
			<circle
				cx={node.cx}
				cy={node.cy}
				r={node.r}
				fill={node.fill}
				stroke={node.stroke}
				strokeWidth={node.strokeWidth}
				opacity={node.opacity}
			/>
		);
	}
	if (node.kind === 'polygon') {
		return (
			<polygon
				points={node.points}
				fill={node.fill}
				stroke={node.stroke}
				strokeWidth={node.strokeWidth}
				opacity={node.opacity}
			/>
		);
	}
	return (
		<rect
			x={node.x}
			y={node.y}
			width={node.width}
			height={node.height}
			rx={node.rx}
			fill={node.fill}
			stroke={node.stroke}
			strokeWidth={node.strokeWidth}
			opacity={node.opacity}
		/>
	);
}

/** Label placement for one rendered node, honouring the optional overrides. */
function labelAnchor(node: RenderedNode): {
	x: number;
	y: number;
	textAnchor: 'start' | 'middle' | 'end';
	baseline: 'top' | 'middle' | 'bottom';
} {
	if (node.kind === 'circle') {
		return {
			x: node.textX ?? node.cx,
			y: node.textY ?? node.cy,
			textAnchor: node.textAnchor ?? 'middle',
			baseline: node.textBaseline ?? 'middle',
		};
	}
	return { x: node.textX, y: node.textY, textAnchor: 'middle', baseline: 'middle' };
}

export function SmartArtLayoutSvg({
	layout,
	nodeIds,
	nodeLabels,
}: SmartArtLayoutSvgProps): React.ReactElement {
	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={layout.viewBox}
			preserveAspectRatio='xMidYMid meet'
			data-testid={`smartart-${layout.family}`}
			data-layout-family={layout.family}
		>
			{/* Connectors first so they paint behind the nodes. */}
			{layout.connectors.map((connector) => (
				<ConnectorPath key={connector.key} connector={connector} />
			))}
			{layout.nodes.map((node, i) => {
				const nodeId = nodeIds[i];
				const label = nodeId ? nodeLabels?.get(nodeId) : undefined;
				const anchor = labelAnchor(node);
				return (
					<g
						key={node.key}
						{...smartArtNodeGroupProps(nodeId ?? node.key, layout.shadowFilter, label)}
					>
						{label ? <title>{label}</title> : null}
						<NodeShape node={node} />
						{node.text.length > 0 ? (
							<SmartArtNodeText
								x={anchor.x}
								y={anchor.y}
								text={node.text}
								fill={node.fontColor ?? DEFAULT_LABEL_COLOR}
								fontSize={node.fontSize}
								fontWeight={node.fontWeight}
								fontStyle={node.fontStyle}
								textAnchor={anchor.textAnchor}
								anchor={anchor.baseline}
								className='pointer-events-none'
							/>
						) : null}
					</g>
				);
			})}
		</svg>
	);
}
