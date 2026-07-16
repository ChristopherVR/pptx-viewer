import JSZip from 'jszip';

import { generatePackageReadme } from '../internal/shared';

/** Build the ZIP downloaded by the File tab's Package for Sharing action. */
export async function buildSharingPackage(
	presentation: Uint8Array,
	presentationFilename: string,
): Promise<Blob> {
	const zip = new JSZip();
	const folder = zip.folder('presentation-package');
	if (!folder) {
		throw new Error('Unable to create presentation package');
	}
	folder.file(presentationFilename, presentation);
	folder.file('README.txt', generatePackageReadme(presentationFilename));
	return zip.generateAsync({ type: 'blob' });
}
