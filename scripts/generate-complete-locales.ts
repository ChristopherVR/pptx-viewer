import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import ts from 'typescript';

import { translationsEn } from '../packages/shared/src/i18n/translations-en';
import { localeSectionNameForKey, MAX_LOCALE_SECTION_ENTRIES } from './locale-sections';

const ROOT = resolve(import.meta.dir, '..');
const BATCH_SIZE = 45;
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/gu;

async function loadLiteralObject(
	path: string,
	exportName: string,
): Promise<Record<string, string>> {
	const source = ts.createSourceFile(
		path,
		await readFile(path, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const values: Record<string, string> = {};
	const unwrapObjectLiteral = (
		expression: ts.Expression,
	): ts.ObjectLiteralExpression | undefined => {
		let current = expression;
		while (
			ts.isAsExpression(current) ||
			ts.isSatisfiesExpression(current) ||
			ts.isParenthesizedExpression(current)
		) {
			current = current.expression;
		}
		return ts.isObjectLiteralExpression(current) ? current : undefined;
	};
	const visit = (node: ts.Node): void => {
		const initializer =
			ts.isVariableDeclaration(node) && node.initializer
				? unwrapObjectLiteral(node.initializer)
				: undefined;
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === exportName &&
			initializer
		) {
			for (const property of initializer.properties) {
				if (
					ts.isPropertyAssignment(property) &&
					ts.isStringLiteralLike(property.name) &&
					ts.isStringLiteralLike(property.initializer)
				) {
					values[property.name.text] = property.initializer.text;
				}
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return values;
}

async function loadCurated(exportName: string): Promise<Record<string, string>> {
	return loadLiteralObject(resolve(ROOT, 'demos', 'demo-react', 'i18n-locales.ts'), exportName);
}

async function loadGenerated(locale: string): Promise<Record<string, string>> {
	const directory = resolve(ROOT, 'packages', 'locales', 'src', locale);
	try {
		const sectionFiles = (await readdir(directory)).filter(
			(file) => file.endsWith('.ts') && file !== 'index.ts',
		);
		const values = await Promise.all(
			sectionFiles.map((file) => loadLiteralObject(resolve(directory, file), 'translations')),
		);
		return Object.assign({}, ...values);
	} catch {
		return {};
	}
}

const locales = [
	{
		code: 'fr',
		exportName: 'translationsFr',
		curated: { ...(await loadCurated('translationsFr')), ...(await loadGenerated('fr')) },
	},
	{
		code: 'es',
		exportName: 'translationsEs',
		curated: { ...(await loadCurated('translationsEs')), ...(await loadGenerated('es')) },
	},
	{
		code: 'de',
		exportName: 'translationsDe',
		curated: { ...(await loadCurated('translationsDe')), ...(await loadGenerated('de')) },
	},
] as const;

function maskPlaceholders(value: string): { masked: string; placeholders: string[] } {
	const placeholders: string[] = [];
	return {
		masked: value.replace(PLACEHOLDER_RE, (placeholder) => {
			const index = placeholders.push(placeholder) - 1;
			return `__PPTX_PLACEHOLDER_${index}__`;
		}),
		placeholders,
	};
}

function restorePlaceholders(value: string, placeholders: string[]): string {
	return placeholders.reduce(
		(result, placeholder, index) => result.replaceAll(`__PPTX_PLACEHOLDER_${index}__`, placeholder),
		value,
	);
}

function hasMatchingPlaceholders(candidate: string, english: string): boolean {
	const candidateKeys = [...candidate.matchAll(PLACEHOLDER_RE)].map(([value]) => value).sort();
	const englishKeys = [...english.matchAll(PLACEHOLDER_RE)].map(([value]) => value).sort();
	return JSON.stringify(candidateKeys) === JSON.stringify(englishKeys);
}

async function translateBatch(values: string[], locale: string): Promise<string[]> {
	const masked = values.map(maskPlaceholders);
	const params = new URLSearchParams({ client: 'gtx', format: 'text', sl: 'en', tl: locale });
	for (const value of masked) {
		params.append('q', value.masked);
	}
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		const response = await fetch(`https://translate.googleapis.com/translate_a/t?${params}`);
		if (response.ok) {
			const translated = (await response.json()) as string[];
			if (translated.length !== values.length) {
				throw new Error(`Expected ${values.length} translations, received ${translated.length}`);
			}
			return translated.map((value, index) =>
				restorePlaceholders(value, masked[index].placeholders),
			);
		}
		if (attempt === 5) {
			throw new Error(`Translation request failed: ${response.status} ${response.statusText}`);
		}
		await Bun.sleep(attempt * 500);
	}
	throw new Error('Translation retry loop exited unexpectedly');
}

function moduleSource(entries: [string, string][]): string {
	const lines = entries.map(
		([key, value]) => `\t${JSON.stringify(key)}: ${JSON.stringify(value)},`,
	);
	return `export const translations = {\n${lines.join('\n')}\n} as const;\n`;
}

async function generateLocale(locale: (typeof locales)[number]): Promise<void> {
	const entries = Object.entries(translationsEn);
	const completed = new Map<string, string>();
	const missing = entries.filter(
		([key, english]) =>
			!locale.curated[key] || !hasMatchingPlaceholders(locale.curated[key], english),
	);

	for (const [key, english] of entries) {
		if (locale.curated[key] && hasMatchingPlaceholders(locale.curated[key], english)) {
			completed.set(key, locale.curated[key]);
		}
	}
	for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
		const batch = missing.slice(offset, offset + BATCH_SIZE);
		const translated = await translateBatch(
			batch.map(([, value]) => value),
			locale.code,
		);
		batch.forEach(([key], index) => completed.set(key, translated[index]));
		process.stdout.write(
			`\r${locale.code}: ${Math.min(offset + batch.length, missing.length)}/${missing.length}`,
		);
	}
	process.stdout.write('\n');

	const output = resolve(ROOT, 'packages', 'locales', 'src', locale.code);
	await mkdir(output, { recursive: true });
	const sections = new Map<string, [string, string][]>();
	for (const [key] of entries) {
		const sectionName = localeSectionNameForKey(key);
		const section = sections.get(sectionName) ?? [];
		section.push([key, completed.get(key)!]);
		sections.set(sectionName, section);
	}
	for (const [name, section] of sections) {
		if (section.length > MAX_LOCALE_SECTION_ENTRIES) {
			throw new Error(
				`${name} contains ${section.length} entries; split the section before generating`,
			);
		}
	}
	const oldSectionFiles = (await readdir(output)).filter(
		(file) => file.endsWith('.ts') && file !== 'index.ts',
	);
	await Promise.all(oldSectionFiles.map((file) => rm(resolve(output, file))));
	const imports: string[] = [];
	const spreads: string[] = [];
	for (const [name, section] of sections) {
		const identifier = name.replaceAll('-', '_');
		await Bun.write(resolve(output, `${name}.ts`), moduleSource(section));
		imports.push(`import { translations as ${identifier} } from './${name}';`);
		spreads.push(`\t...${identifier},`);
	}
	await Bun.write(
		resolve(output, 'index.ts'),
		`${imports.join('\n')}\n\nexport const ${locale.exportName}: Record<string, string> = {\n${spreads.join('\n')}\n};\n`,
	);
}

for (const locale of locales) {
	await generateLocale(locale);
}

await Bun.write(
	resolve(ROOT, 'packages', 'locales', 'src', 'index.ts'),
	"export { translationsFr } from './fr';\nexport { translationsEs } from './es';\nexport { translationsDe } from './de';\n",
);
