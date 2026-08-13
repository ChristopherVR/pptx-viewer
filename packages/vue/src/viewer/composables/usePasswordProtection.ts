import { ref } from 'vue';
import type { Ref } from 'vue';

export interface UsePasswordProtectionResult {
	showPasswordDialog: Ref<boolean>;
	isPasswordProtected: Ref<boolean>;
	presentationPassword: Ref<string | null>;
	onSetPassword: (password: string) => void;
	onRemovePassword: () => void;
}

/**
 * usePasswordProtection: File ▸ Protect Presentation dialog. Mirrors React:
 * the password lives in host state and the save path reads it through the
 * shared `planDeckSave`/`saveDeckWithPassword` decision, so a protected deck
 * serialises to an encrypted OLE2 container instead of a plain ZIP. The
 * viewer creates this composable ahead of `useLoadContent` and hands it in as
 * `getSaveIntent`.
 */
export function usePasswordProtection(): UsePasswordProtectionResult {
	const showPasswordDialog = ref(false);
	const isPasswordProtected = ref(false);
	const presentationPassword = ref<string | null>(null);

	function onSetPassword(password: string): void {
		presentationPassword.value = password;
		isPasswordProtected.value = true;
	}
	function onRemovePassword(): void {
		presentationPassword.value = null;
		isPasswordProtected.value = false;
	}

	return {
		showPasswordDialog,
		isPasswordProtected,
		presentationPassword,
		onSetPassword,
		onRemovePassword,
	};
}
