/**
 * Re-apply a SmartArt quick style's per-label 3D onto REGENERATED drawing
 * shapes (a pure decision function, no runtime state).
 *
 * PowerPoint bakes each `dgm:styleLbl`'s 3D onto every cached drawing shape.
 * A structural edit (add / remove / reorder a node) drops that cache, and the
 * shapes the layout engine produces instead carry no 3D, so a bevel or scene
 * quick style used to reopen (and render) flat. This resolves each shape's
 * style label (the `presStyleLbl` of the node it presents,
 * `PptxSmartArtNode.styleRole`) and copies that label's 3D onto the shape,
 * mirroring what PowerPoint writes when it re-lays out a diagram:
 *
 * - `a:scene3d`: the label's scene, UNLESS it is the default front camera
 *   with a plain top `threePt` light (the flat and "Scene" quick styles,
 *   which carry no per-shape scene; their camera is the whole-diagram
 *   `PptxSmartArtQuickStyle.scene3d`).
 * - `a:sp3d`: the label's bevel / extrusion / contour, when it has one.
 * - `a:bodyPr/a:sp3d`: the label's `dgm:txPr` text extrusion, when it has one.
 *
 * A field the shape already carries is never overwritten.
 *
 * @module smartart-quick-style-3d
 */
import type {
	Pptx3DScene,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	PptxSmartArtQuickStyle,
	PptxSmartArtQuickStyleLabel,
} from '../types';

/** The label a shape falls back to when no node role resolves (every layout's primary role). */
const PRIMARY_STYLE_LABEL = 'node1';

/**
 * Whether a label scene is the implicit default (front camera, top `threePt`
 * light, no rotation / zoom / fov / backdrop), which PowerPoint does not
 * write onto a cached shape.
 */
export function isDefaultSmartArtLabelScene(scene: Pptx3DScene): boolean {
	const camera = scene.cameraPreset ?? 'orthographicFront';
	const rig = scene.lightRigType ?? 'threePt';
	const dir = scene.lightRigDirection ?? 't';
	return (
		camera === 'orthographicFront' &&
		rig === 'threePt' &&
		dir === 't' &&
		scene.cameraFieldOfView === undefined &&
		scene.cameraZoom === undefined &&
		scene.cameraRotX === undefined &&
		scene.cameraRotY === undefined &&
		scene.cameraRotZ === undefined &&
		scene.lightRigRotX === undefined &&
		scene.lightRigRotY === undefined &&
		scene.lightRigRotZ === undefined &&
		!scene.hasBackdrop
	);
}

/** Whether a label contributes any 3D to a shape. */
function labelHas3d(label: PptxSmartArtQuickStyleLabel): boolean {
	return Boolean(
		label.shape3d || label.text3d || (label.scene3d && !isDefaultSmartArtLabelScene(label.scene3d)),
	);
}

/** Whether a quick style carries any per-label 3D at all (bevel / scene styles). */
export function smartArtQuickStyleHas3d(quickStyle: PptxSmartArtQuickStyle | undefined): boolean {
	return Boolean(quickStyle?.labels?.some(labelHas3d));
}

/**
 * `nodeId -> style label`. A node with no role of its own (a node added by an
 * edit) inherits a sibling's, the role its presentation point would get.
 */
function resolveNodeLabels(nodes: PptxSmartArtNode[]): Map<string, string> {
	const roleByParent = new Map<string | undefined, string>();
	for (const node of nodes) {
		if (node.styleRole && !roleByParent.has(node.parentId)) {
			roleByParent.set(node.parentId, node.styleRole);
		}
	}
	const labels = new Map<string, string>();
	for (const node of nodes) {
		const role = node.styleRole ?? roleByParent.get(node.parentId);
		if (role) {
			labels.set(node.id, role);
		}
	}
	return labels;
}

/** The node a regenerated shape presents (`<prefix>-<nodeId>` or the bare id). */
function nodeIdForShape(shapeId: string, nodes: PptxSmartArtNode[]): string | undefined {
	return nodes.find((node) => node.id && (shapeId === node.id || shapeId.endsWith(`-${node.id}`)))
		?.id;
}

/** Copy a label's 3D onto a shape, keeping any 3D the shape already has. */
function withLabel3d(
	shape: PptxSmartArtDrawingShape,
	label: PptxSmartArtQuickStyleLabel,
): PptxSmartArtDrawingShape {
	const scene3d =
		label.scene3d && !isDefaultSmartArtLabelScene(label.scene3d) ? label.scene3d : undefined;
	return {
		...shape,
		...(!shape.scene3d && scene3d ? { scene3d: structuredClone(scene3d) } : {}),
		...(!shape.shape3d && label.shape3d ? { shape3d: structuredClone(label.shape3d) } : {}),
		...(!shape.text3d && label.text3d ? { text3d: structuredClone(label.text3d) } : {}),
	};
}

/**
 * Apply the diagram's quick-style per-label 3D to regenerated drawing shapes.
 * Returns the input untouched when the quick style is flat (or absent).
 */
export function applySmartArtQuickStyle3d(
	shapes: PptxSmartArtDrawingShape[],
	data: Pick<PptxSmartArtData, 'nodes' | 'quickStyle'>,
): PptxSmartArtDrawingShape[] {
	const quickStyle = data.quickStyle;
	if (shapes.length === 0 || !smartArtQuickStyleHas3d(quickStyle)) {
		return shapes;
	}
	const labelsByName = new Map<string, PptxSmartArtQuickStyleLabel>();
	for (const label of quickStyle?.labels ?? []) {
		if (!labelsByName.has(label.name)) {
			labelsByName.set(label.name, label);
		}
	}
	const nodeLabels = resolveNodeLabels(data.nodes);
	const fallback =
		labelsByName.get(PRIMARY_STYLE_LABEL) ??
		labelsByName.get(nodeLabels.values().next().value ?? '');
	return shapes.map((shape) => {
		const nodeId = nodeIdForShape(shape.id, data.nodes);
		const labelName = nodeId ? nodeLabels.get(nodeId) : undefined;
		const label = (labelName ? labelsByName.get(labelName) : undefined) ?? fallback;
		return label ? withLabel3d(shape, label) : shape;
	});
}
