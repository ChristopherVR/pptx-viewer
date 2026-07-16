export interface EditorControllerDeps {
	getScale(): number;
	getCurrent(): number;
	getPresenting(): boolean;
	getStageRoot(): Element | null;
	getHolderEl(): HTMLElement | null;
	onCursorMove?(x: number, y: number): void;
	onContextMenu?(x: number, y: number): void;
	getSnapToGrid?(): boolean;
	getSnapToShape?(): boolean;
	getGuides?(): readonly { axis: 'h' | 'v'; position: number }[];
}
