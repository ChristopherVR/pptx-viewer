export interface RibbonIconNode {
	tag: string;
	attrs: Record<string, string>;
	text?: string;
	children?: readonly RibbonIconNode[];
}
export interface RibbonIconArtwork {
	attrs: Record<string, string>;
	children: readonly RibbonIconNode[];
}
