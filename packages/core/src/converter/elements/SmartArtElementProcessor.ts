import type { PptxElement } from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

interface SmartArtNodeLike {
	id: string;
	text: string;
	parentId?: string;
	children?: SmartArtNodeLike[];
}

interface SmartArtDataLike {
	resolvedLayoutType?: string;
	nodes: SmartArtNodeLike[];
}

interface SmartArtElementLike {
	smartArtData?: SmartArtDataLike;
}

const ORDERED_LAYOUTS = new Set(['process', 'cycle', 'timeline']);
const NESTED_LAYOUTS = new Set(['hierarchy', 'pyramid', 'funnel']);
const BULLET_LAYOUTS = new Set(['list', 'matrix', 'gear', 'target']);

export class SmartArtElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['smartArt'] as const;

	public async process(
		element: PptxElement,
		_ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'smartArt') return null;
		const smartArtData = (element as SmartArtElementLike).smartArtData;
		if (!smartArtData || smartArtData.nodes.length === 0) {
			return '*[SmartArt: no nodes]*';
		}

		const roots = this.resolveRoots(smartArtData.nodes);
		const layoutType = smartArtData.resolvedLayoutType ?? 'unknown';
		const parts: string[] = [`*[SmartArt: ${layoutType}]*`];

		if (NESTED_LAYOUTS.has(layoutType)) {
			parts.push(this.renderNestedList(roots, 0));
		} else if (ORDERED_LAYOUTS.has(layoutType)) {
			parts.push(this.renderOrderedSequence(roots));
		} else if (BULLET_LAYOUTS.has(layoutType)) {
			parts.push(this.renderBulletList(roots));
		} else if (layoutType === 'relationship') {
			parts.push(this.renderRelationshipText(roots));
		} else {
			parts.push(this.renderBulletList(roots));
		}

		return parts.join('\n\n');
	}

	private resolveRoots(nodes: SmartArtNodeLike[]): SmartArtNodeLike[] {
		if (
			nodes.some(
				(node) =>
					Array.isArray(node.children) && node.children.length > 0
			)
		) {
			return nodes;
		}

		const nodeMap = new Map<string, SmartArtNodeLike>();
		for (const node of nodes) {
			nodeMap.set(node.id, { ...node, children: [] });
		}

		const roots: SmartArtNodeLike[] = [];
		for (const node of nodeMap.values()) {
			if (node.parentId && nodeMap.has(node.parentId)) {
				nodeMap.get(node.parentId)?.children?.push(node);
			} else {
				roots.push(node);
			}
		}

		return roots.length > 0 ? roots : [...nodeMap.values()];
	}

	private renderNestedList(nodes: SmartArtNodeLike[], level: number): string {
		const lines: string[] = [];
		const indent = '  '.repeat(level);
		for (const node of nodes) {
			const text = node.text.trim();
			if (text) {
				lines.push(`${indent}- ${text}`);
			}
			if (node.children && node.children.length > 0) {
				lines.push(this.renderNestedList(node.children, level + 1));
			}
		}
		return lines.join('\n');
	}

	private renderOrderedSequence(nodes: SmartArtNodeLike[]): string {
		const flattened = this.flattenNodes(nodes)
			.map((node) => node.text.trim())
			.filter((text) => text.length > 0);
		const lines: string[] = [];
		for (let index = 0; index < flattened.length; index += 1) {
			lines.push(`${index + 1}. ${flattened[index]}`);
		}
		return lines.join('\n');
	}

	private renderBulletList(nodes: SmartArtNodeLike[]): string {
		return this.flattenNodes(nodes)
			.map((node) => node.text.trim())
			.filter((text) => text.length > 0)
			.map((text) => `- ${text}`)
			.join('\n');
	}

	private renderRelationshipText(nodes: SmartArtNodeLike[]): string {
		const entries = this.flattenNodes(nodes)
			.map((node) => node.text.trim())
			.filter((text) => text.length > 0);
		if (entries.length === 0) {
			return '*[SmartArt relationship]*';
		}
		if (entries.length === 1) {
			return entries[0];
		}
		return entries.join(' -> ');
	}

	private flattenNodes(nodes: SmartArtNodeLike[]): SmartArtNodeLike[] {
		const flattened: SmartArtNodeLike[] = [];
		for (const node of nodes) {
			flattened.push(node);
			if (node.children && node.children.length > 0) {
				flattened.push(...this.flattenNodes(node.children));
			}
		}
		return flattened;
	}
}
