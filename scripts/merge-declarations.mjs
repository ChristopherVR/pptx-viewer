import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';

const sourceDir = join(process.cwd(), process.argv[2] ?? '.types');
const outputDir = join(process.cwd(), 'dist');

async function copyDeclarations(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const sourcePath = join(directory, entry.name);
		if (entry.isDirectory()) {
			await copyDeclarations(sourcePath);
			continue;
		}

		if (!entry.name.endsWith('.d.ts') && !entry.name.endsWith('.d.ts.map')) {
			continue;
		}

		const destination = join(outputDir, relative(sourceDir, sourcePath));
		await mkdir(join(destination, '..'), { recursive: true });
		await cp(sourcePath, destination);
	}
}

await copyDeclarations(sourceDir);
await rm(sourceDir, { recursive: true, force: true });
