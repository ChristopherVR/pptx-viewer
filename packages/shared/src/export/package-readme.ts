/** Build the README bundled with a presentation package-for-sharing archive. */
export function generatePackageReadme(presentationFilename: string): string {
	return [
		'Presentation Package',
		'====================',
		'',
		`This folder contains the presentation "${presentationFilename}" along with`,
		'all linked media files (images, audio, video) in the /media subfolder.',
		'',
		'To view this presentation:',
		'1. Open the presentation file with any compatible presentation software',
		'2. Ensure the /media folder remains alongside the presentation file',
		'',
		`Packaged on ${new Date().toLocaleDateString()}`,
		'',
	].join('\n');
}
