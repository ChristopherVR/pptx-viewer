import { useExternalYjsSession } from './useExternalYjsSession';
import { useYjsProvider } from './useYjsProvider';
import type { UseYjsProviderInput } from './useYjsProvider';

/** Select ownership internally without narrowing the public provider result. */
export function useCollaborationSession({ config }: UseYjsProviderInput) {
	const owned = useYjsProvider({ config: config?.externalSession ? undefined : config });
	const external = useExternalYjsSession(config?.externalSession);
	return config?.externalSession ? external : owned;
}
