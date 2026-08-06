/**
 * Chat-history affordance contract for the Angular AI panel.
 *
 * Angular has no TestBed in this suite (see `vitest.config.ts`), so, like the
 * other `*.contract.test.ts` guards, this reads the component sources and
 * asserts the load-bearing template pieces: the panel embeds the history menu,
 * and the menu renders a "Chats" toggle plus the saved-chat dropdown (resume /
 * delete / New chat / empty state / hint) wired to `AiHistoryService`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MENU = readFileSync(path.join(import.meta.dirname, 'ai-history-menu.component.ts'), 'utf8');
const PANEL = readFileSync(path.join(import.meta.dirname, 'ai-chat-panel.component.ts'), 'utf8');

describe('ai chat-history contract', () => {
	it('the panel mounts the history menu in the ready state and persists transcript changes', () => {
		expect(PANEL).toContain('<pptx-ai-history-menu');
		expect(PANEL).toContain('AiHistoryService');
		expect(PANEL).toContain('notifyMessagesChanged()');
		expect(PANEL).toMatch(
			/setMessages:\s*\(messages\)\s*=>\s*this\.chat\.setMessages\(messages\)/u,
		);
	});

	it('the menu renders a Chats toggle button', () => {
		expect(MENU).toMatch(/\(click\)="history\.toggleMenu\(\)"/u);
		expect(MENU).toContain("'pptx.ai.chats' | translate");
	});

	it('the dropdown offers resume, delete, New chat, the empty state, and the hint', () => {
		expect(MENU).toContain('history.menuOpen()');
		expect(MENU).toMatch(/\(click\)="resume\(chat\.id\)"/u);
		expect(MENU).toMatch(/\(click\)="deleteChat\(chat\.id\)"/u);
		expect(MENU).toContain("'pptx.ai.newChat' | translate");
		expect(MENU).toContain("'pptx.ai.historyTitle' | translate");
		expect(MENU).toContain("'pptx.ai.historyEmpty' | translate");
		expect(MENU).toContain("'pptx.ai.historyHint' | translate");
	});

	it('resume closes the dropdown and routes through the service', () => {
		expect(MENU).toMatch(
			/resume\(id: string\): void \{\s*void this\.history\.resumeChat\(id\);\s*this\.history\.menuOpen\.set\(false\);/u,
		);
	});
});
