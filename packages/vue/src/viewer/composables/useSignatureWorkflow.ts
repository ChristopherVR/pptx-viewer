import type { ParsedSignature } from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useSignatures } from './useSignatures';
import type { UseSignaturesResult } from './useSignatures';

export interface UseSignatureWorkflowInput {
	signatures: Ref<ParsedSignature[]>;
	/** Autosave dirty flag; a signed deck warns once on its first dirtying edit. */
	isDirty: ComputedRef<boolean> | Ref<boolean>;
}

export interface UseSignatureWorkflowResult {
	showSignatures: Ref<boolean>;
	signaturesApi: UseSignaturesResult;
	hasDigitalSignatures: ComputedRef<boolean>;
	showSignatureStripped: Ref<boolean>;
	onAckSignatureStripped: () => void;
}

/**
 * useSignatureWorkflow: File ▸ Digital Signatures panel plus the "saving a
 * signed deck strips signatures" first-edit warning (mirrors React's
 * `useViewerDialogs` signature-strip effect). Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useSignatureWorkflow(input: UseSignatureWorkflowInput): UseSignatureWorkflowResult {
	const { signatures, isDirty } = input;

	const showSignatures = ref(false);
	const signaturesApi = useSignatures(signatures);
	const hasDigitalSignatures = computed(() => signatures.value.length > 0);
	// Warn once, on the first edit of a signed deck, that saving strips signatures.
	const showSignatureStripped = ref(false);
	const signatureStripAcknowledged = ref(false);
	watch(
		() => isDirty.value,
		(dirty) => {
			if (dirty && hasDigitalSignatures.value && !signatureStripAcknowledged.value) {
				showSignatureStripped.value = true;
			}
		},
	);
	function onAckSignatureStripped(): void {
		signatureStripAcknowledged.value = true;
		showSignatureStripped.value = false;
	}

	return {
		showSignatures,
		signaturesApi,
		hasDigitalSignatures,
		showSignatureStripped,
		onAckSignatureStripped,
	};
}
