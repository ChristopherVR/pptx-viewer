import type { PptxSmartArtNode, SmartArtLayoutType } from '../types';
import type { ContainerBounds } from './smartart-helpers';
import {
	computeCycleLayout,
	computeHierarchyLayout,
	computeLinearLayout,
	computeMatrixLayout,
	computePyramidLayout,
	computeSnakeLayout,
} from './smartart-layout-engine-algorithms';
import type {
	LayoutAlgorithmType,
	LayoutConstraints,
	LayoutEngineShape,
} from './smartart-layout-engine-types';

export function computeByAlgorithmType(
	type: LayoutAlgorithmType,
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	switch (type) {
		case 'snake':
			return computeSnakeLayout(nodes, constraints, bounds);
		case 'hierChild':
		case 'hierRoot':
			return computeHierarchyLayout(nodes, constraints, bounds);
		case 'cycle':
			return computeCycleLayout(nodes, constraints, bounds);
		case 'pyra':
			return computePyramidLayout(nodes, constraints, bounds);
		default:
			return computeLinearLayout(nodes, constraints, bounds);
	}
}

export function computeByLayoutType(
	type: SmartArtLayoutType,
	nodes: PptxSmartArtNode[],
	constraints: LayoutConstraints,
	bounds: ContainerBounds,
): LayoutEngineShape[] {
	switch (type) {
		case 'list':
			return computeLinearLayout(nodes, { ...constraints, aspectRatio: 0.3 }, bounds);
		case 'cycle':
		case 'relationship':
		case 'venn':
		case 'target':
			return computeCycleLayout(nodes, constraints, bounds);
		case 'hierarchy':
			return computeHierarchyLayout(nodes, constraints, bounds);
		case 'matrix':
			return computeMatrixLayout(nodes, constraints, bounds);
		case 'pyramid':
		case 'funnel':
			return computePyramidLayout(nodes, constraints, bounds);
		case 'bending':
			return computeSnakeLayout(nodes, constraints, bounds);
		case 'gear':
			return computeCycleLayout(nodes, { ...constraints, w: 0.2 }, bounds);
		default:
			return computeLinearLayout(nodes, constraints, bounds);
	}
}

export function resolveLayoutTypeFromString(value: string | undefined): SmartArtLayoutType {
	const type = value?.toLowerCase() ?? '';
	if (type.includes('hierarchy') || type.includes('org')) {
		return 'hierarchy';
	}
	if (type.includes('cycle') || type.includes('radial')) {
		return 'cycle';
	}
	if (type.includes('snake') || type.includes('bending') || type.includes('zigzag')) {
		return 'bending';
	}
	if (type.includes('process') || type.includes('chevron') || type.includes('arrow')) {
		return 'process';
	}
	if (type.includes('venn') || type.includes('relationship')) {
		return 'relationship';
	}
	if (type.includes('matrix')) {
		return 'matrix';
	}
	if (type.includes('pyramid')) {
		return 'pyramid';
	}
	if (type.includes('funnel')) {
		return 'funnel';
	}
	if (type.includes('timeline')) {
		return 'timeline';
	}
	if (type.includes('target') || type.includes('bullseye')) {
		return 'target';
	}
	if (type.includes('gear')) {
		return 'gear';
	}
	return 'list';
}

export function getDefaultShapeType(type: SmartArtLayoutType): string {
	if (['cycle', 'target', 'gear', 'relationship', 'venn'].includes(type)) {
		return 'ellipse';
	}
	if (type === 'chevron') {
		return 'chevron';
	}
	if (type === 'pyramid' || type === 'funnel') {
		return 'trapezoid';
	}
	return 'roundRect';
}
