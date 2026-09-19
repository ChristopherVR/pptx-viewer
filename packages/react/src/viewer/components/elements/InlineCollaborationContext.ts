import type { PptxElement } from 'pptx-viewer-core';
import type { CollaborationLivePatcher, InlineListReadResult } from 'pptx-viewer-shared';
import { createContext } from 'react';

/** Explicitly scoped to one mounted canvas, including custom editor shells. */
export interface InlineCollaborationContextValue {
	patcher: CollaborationLivePatcher;
	slideId: string | undefined;
	/** Inherited template shapes are not members of the slide's shared model. */
	elementIds: ReadonlySet<string>;
	/** Retain accepted text only when this exact editor becomes read-only. */
	readReadOnlyElement?: (elementId: string) => PptxElement | undefined;
	registerReader?: (elementId: string, read: () => InlineListReadResult) => () => void;
}

export const InlineCollaborationContext = createContext<
	InlineCollaborationContextValue | undefined
>(undefined);
