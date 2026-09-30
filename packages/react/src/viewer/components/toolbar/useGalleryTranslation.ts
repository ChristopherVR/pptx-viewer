import { galleryTextLabel } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

export function useTranslateOr(): (key: string | undefined, fallback: string) => string {
	const { t } = useTranslation();
	return (key, fallback) => galleryTextLabel(t, key, fallback);
}
