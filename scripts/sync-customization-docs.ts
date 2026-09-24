/**
 * Rewrites the generated reference section of docs/guide/customization.md
 * from the shared customisation catalogues, then formats it with oxfmt (the
 * same formatter the pre-commit hook runs). Run with
 * `bun run docs:customization` after adding or renaming a customisation id;
 * `customization-reference.test.ts` in packages/shared fails until you do.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	normalizeReferenceMarkdown,
	replaceCustomizationReference,
} from '../packages/shared/src/render/customization/customization-reference';

const docPath = resolve(import.meta.dirname, '../docs/guide/customization.md');
const before = readFileSync(docPath, 'utf8');
const after = replaceCustomizationReference(before);
if (normalizeReferenceMarkdown(after) === normalizeReferenceMarkdown(before)) {
	console.log('customization reference already up to date');
} else {
	writeFileSync(docPath, after);
	execFileSync('bunx', ['oxfmt', docPath], { stdio: 'inherit', shell: true });
	console.log('customization reference rewritten');
}
