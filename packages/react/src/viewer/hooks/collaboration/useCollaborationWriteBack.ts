import { createWriteBackScheduler } from 'pptx-viewer-shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { buildSaveSlides } from '../../utils/template-editing';
import type { UseYjsDocumentSyncInput } from './useYjsDocumentSync';

type Input = Pick<
	UseYjsDocumentSyncInput,
	'doc' | 'config' | 'isSynced' | 'getSourceBytes' | 'getSaveOptions' | 'templateElementsBySlideId'
>;

/** Keep framework lifecycle local and durable serialization in shared. */
export function useCollaborationWriteBack(input: Input): () => void {
	const latest = useRef(input);
	latest.current = input;
	const scheduler = useMemo(
		() =>
			createWriteBackScheduler({
				getYDoc: () => latest.current.doc,
				getSourceBytes: () => latest.current.getSourceBytes?.() ?? null,
				getSaveOptions: () => latest.current.getSaveOptions?.(),
				getTemplateElements: () => latest.current.templateElementsBySlideId,
				mergeTemplateElements: buildSaveSlides,
			}),
		[latest],
	);
	/* oxlint-disable react/exhaustive-effect-dependencies -- session identity cancels in-flight saves */
	useEffect(
		() => () => scheduler.cancel(),
		[
			scheduler,
			input.doc,
			input.config?.role,
			input.config?.onWriteBack,
			input.config?.externalSession,
		],
	);
	/* oxlint-enable react/exhaustive-effect-dependencies */
	return useCallback(() => {
		const { config } = latest.current;
		if (config) {
			scheduler.schedule(config);
		}
	}, [scheduler, latest]);
}
