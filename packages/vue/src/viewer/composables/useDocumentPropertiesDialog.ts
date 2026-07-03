import type { PptxAppProperties, PptxCoreProperties, PptxCustomProperty } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { DocumentPropertiesSavePatch } from '../components/DocumentPropertiesDialog.vue';

export interface UseDocumentPropertiesDialogInput {
	coreProperties: Ref<PptxCoreProperties | undefined>;
	customProperties: Ref<PptxCustomProperty[]>;
	appProperties: Ref<PptxAppProperties | undefined>;
}

export interface UseDocumentPropertiesDialogResult {
	propertiesOpen: Ref<boolean>;
	onPropertiesSave: (patch: DocumentPropertiesSavePatch) => void;
}

/**
 * useDocumentPropertiesDialog: File ▸ Document Properties (General /
 * Statistics / Custom tabs). Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useDocumentPropertiesDialog(
	input: UseDocumentPropertiesDialogInput,
): UseDocumentPropertiesDialogResult {
	const { coreProperties, customProperties, appProperties } = input;

	const propertiesOpen = ref(false);
	function onPropertiesSave(patch: DocumentPropertiesSavePatch): void {
		// Persist the edited core / custom / app properties; `getContent` forwards
		// all three to `handler.save`, so they round-trip into the saved `.pptx`.
		coreProperties.value = { ...coreProperties.value, ...patch.core };
		customProperties.value = patch.custom;
		if (patch.app) {
			appProperties.value = { ...appProperties.value, ...patch.app };
		}
		propertiesOpen.value = false;
	}

	return { propertiesOpen, onPropertiesSave };
}
