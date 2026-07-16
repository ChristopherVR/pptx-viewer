import type {
	PptxCustomShow,
	PptxHeaderFooter,
	PptxPresentationProperties,
} from 'pptx-viewer-core';

export interface PresentationMetadataHost {
	readonly editable: boolean;
	pushHistory(): void;
	commitChange(): void;
}

/** Owns presentation-level metadata and its undoable editor mutations. */
export class EditorPresentationMetadata {
	headerFooter = $state.raw<PptxHeaderFooter>({});
	presentationProperties = $state.raw<PptxPresentationProperties>({});
	customShows = $state.raw<PptxCustomShow[]>([]);

	constructor(private readonly host: PresentationMetadataHost) {}

	set(
		headerFooter: PptxHeaderFooter = {},
		presentationProperties: PptxPresentationProperties = {},
		customShows: PptxCustomShow[] = [],
	): void {
		this.headerFooter = structuredClone(headerFooter);
		this.presentationProperties = structuredClone(presentationProperties);
		this.customShows = structuredClone(customShows);
	}

	updatePresentationProperties(next: PptxPresentationProperties): void {
		this.commit(() => (this.presentationProperties = structuredClone(next)));
	}

	updateHeaderFooter(next: PptxHeaderFooter): void {
		this.commit(() => (this.headerFooter = structuredClone(next)));
	}

	updateCustomShows(next: PptxCustomShow[]): void {
		this.commit(() => (this.customShows = structuredClone(next)));
	}

	private commit(update: () => void): void {
		if (!this.host.editable) {
			return;
		}
		this.host.pushHistory();
		update();
		this.host.commitChange();
	}
}
