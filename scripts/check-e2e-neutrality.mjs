import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const E2E_DIR = resolve(ROOT, 'e2e');
const REFERENCE_SPEC = 'ribbon-tab-parity.spec.ts';
const PROJECT_IDENTIFIERS = new Set(['framework', 'project', 'projectName']);
const DEMO_PORT_RE = /\b417[3-7]\b/u;
const FRAMEWORK_SELECTOR_RE =
	/(?:\bpptx-(?:angular|ng|react|svelte|vue)\b|\bpptxv\b|\bpptx-presentation-transition-overlay\b)/u;

export function isProductSpec(fileName) {
	return fileName.endsWith('.spec.ts') && !fileName.startsWith('capture-');
}

function location(sourceFile, node) {
	const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
	return { line: point.line + 1, column: point.character + 1 };
}

function addViolation(violations, sourceFile, node, rule, message) {
	violations.push({ file: sourceFile.fileName, ...location(sourceFile, node), rule, message });
}

function containsProjectReference(node, aliases) {
	let found = false;
	const visit = (child) => {
		if (found) {
			return;
		}
		if (
			ts.isIdentifier(child) &&
			(PROJECT_IDENTIFIERS.has(child.text) || aliases.has(child.text))
		) {
			found = true;
			return;
		}
		if (
			ts.isPropertyAccessExpression(child) &&
			child.name.text === 'name' &&
			ts.isPropertyAccessExpression(child.expression) &&
			child.expression.name.text === 'project'
		) {
			found = true;
			return;
		}
		ts.forEachChild(child, visit);
	};
	visit(node);
	return found;
}

function collectProjectAliases(sourceFile) {
	const aliases = new Set();
	let changed = true;
	while (changed) {
		changed = false;
		const visit = (node) => {
			if (
				ts.isVariableDeclaration(node) &&
				ts.isIdentifier(node.name) &&
				node.initializer &&
				containsProjectReference(node.initializer, aliases) &&
				!aliases.has(node.name.text)
			) {
				aliases.add(node.name.text);
				changed = true;
			}
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);
	}
	return aliases;
}

function literalText(node) {
	if (ts.isStringLiteralLike(node)) {
		return node.text;
	}
	if (ts.isTemplateExpression(node)) {
		return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('');
	}
	return undefined;
}

export function scanSource(source, fileName = 'inline.spec.ts') {
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const aliases = collectProjectAliases(sourceFile);
	const violations = [];
	const allowsReferenceOrchestration = basename(fileName) === REFERENCE_SPEC;

	const visit = (node) => {
		if (!allowsReferenceOrchestration) {
			let condition;
			if (ts.isIfStatement(node)) {
				condition = node.expression;
			}
			if (ts.isConditionalExpression(node)) {
				condition = node.condition;
			}
			if (ts.isSwitchStatement(node)) {
				condition = node.expression;
			}
			if (ts.isWhileStatement(node) || ts.isDoStatement(node)) {
				condition = node.expression;
			}
			if (ts.isForStatement(node)) {
				condition = node.condition;
			}
			if (condition && containsProjectReference(condition, aliases)) {
				addViolation(
					violations,
					sourceFile,
					condition,
					'project-conditional',
					'product specs must not branch on the Playwright project or framework',
				);
			}

			if (
				(ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) &&
				DEMO_PORT_RE.test(node.text)
			) {
				addViolation(
					violations,
					sourceFile,
					node,
					'demo-port',
					'demo-port inference is reserved for ribbon-tab-parity orchestration',
				);
			}
		}

		const selector =
			ts.isStringLiteralLike(node) || ts.isTemplateExpression(node) ? literalText(node) : undefined;
		if (selector && FRAMEWORK_SELECTOR_RE.test(selector)) {
			addViolation(
				violations,
				sourceFile,
				node,
				'framework-selector',
				'product specs must use framework-neutral selectors',
			);
		}

		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return violations;
}

export function scanProductSpecs(e2eDir = E2E_DIR) {
	return readdirSync(e2eDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && isProductSpec(entry.name))
		.flatMap((entry) => {
			const path = resolve(e2eDir, entry.name);
			return scanSource(readFileSync(path, 'utf8'), path);
		});
}

export function formatViolations(violations, root = ROOT) {
	return violations
		.map((violation) => {
			const relative = violation.file.startsWith(root)
				? violation.file.slice(root.length + 1).replaceAll('\\', '/')
				: violation.file;
			return `${relative}:${violation.line}:${violation.column} [${violation.rule}] ${violation.message}`;
		})
		.join('\n');
}

function main() {
	const violations = scanProductSpecs();
	if (violations.length > 0) {
		console.error('E2E framework-neutrality violations:\n');
		console.error(formatViolations(violations));
		console.error(
			'\nUse shared semantic contracts. Only ribbon-tab-parity may branch by project or use demo ports.',
		);
		process.exitCode = 1;
		return;
	}
	console.log('E2E framework-neutrality check passed.');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
	main();
}
