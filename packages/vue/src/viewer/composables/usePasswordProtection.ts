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
 * the password lives in host state; encryption on save is not wired in either
 * binding, so this only tracks the protected flag + secret. Extracted
 * verbatim from `PowerPointViewer.vue`.
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
