/**
 * collab-server-hocuspocus.example.mjs
 *
 * Hocuspocus-based collaboration server that pairs with pptx-viewer's
 * built-in collaboration stack (Yjs + y-websocket protocol). Prefer this
 * over `collab-server.example.mjs` when you already run a Node/Hocuspocus
 * stack or want its extension ecosystem (database persistence, Redis
 * horizontal scaling, webhooks); otherwise the sibling example is a
 * zero-dependency Bun server with the same auth + persistence contract.
 *
 * Prerequisites:
 *   npm install @hocuspocus/server @hocuspocus/extension-sqlite
 *
 * Run:
 *   node demos/collab-server-hocuspocus.example.mjs
 *
 * Then point every viewer client at:
 *   serverUrl: 'ws://localhost:1234'
 *   roomId:    '<document-id>'
 *   authToken: '<token>'
 */

import { SQLite } from '@hocuspocus/extension-sqlite';
import { Server } from '@hocuspocus/server';

// ---------------------------------------------------------------------------
// Auth contract
//
// Clients pass `authToken` in CollaborationConfig; the viewer bindings use
// y-websocket, which forwards it as a `?token=` query parameter on the
// websocket handshake.
//
// IMPORTANT: Hocuspocus' `onAuthenticate` hook only fires for clients that
// speak Hocuspocus' own auth protocol message (e.g. @hocuspocus/provider).
// Plain y-websocket clients - which is what pptx-viewer uses - never send
// that message, so the token MUST be validated in `onConnect` via
// `data.requestParameters` instead. Throwing there rejects the connection.
// ---------------------------------------------------------------------------

/** @param {string} token */
async function validateToken(token) {
	// Replace with your real auth (JWT verify, session DB lookup, etc.).
	const allowed = (process.env.COLLAB_AUTH_TOKENS ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
	if (allowed.length === 0) {
		console.warn('[hocuspocus] COLLAB_AUTH_TOKENS unset: auth disabled (dev only)');
		return { userId: 'anonymous' };
	}
	if (!allowed.includes(token)) {
		throw new Error('Unauthorized');
	}
	return { userId: 'user-from-token' };
}

// ---------------------------------------------------------------------------
// Persistence: SQLite out of the box. Documents survive restarts with zero
// configuration; swap for @hocuspocus/extension-database to plug in any
// store that implements fetch/store callbacks.
// ---------------------------------------------------------------------------

const persistence = new SQLite({
	database: process.env.COLLAB_DB_PATH ?? 'collab-documents.sqlite',
});

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Server.configure({
	port: Number(process.env.PORT ?? 1234),

	extensions: [persistence],

	// Fires for every incoming connection, including plain y-websocket
	// clients. Throwing rejects the connection.
	async onConnect(data) {
		const token = data.requestParameters.get('token') ?? '';
		const context = await validateToken(token);
		console.log(`[hocuspocus] client connected to "${data.documentName}"`, context);
		return context;
	},

	// Also honour Hocuspocus-provider clients that send the auth message.
	async onAuthenticate(data) {
		return validateToken(data.token ?? '');
	},

	async onDisconnect(data) {
		console.log(`[hocuspocus] client disconnected from "${data.documentName}"`);
	},
});

await server.listen();
console.log(`[hocuspocus] listening on ws://localhost:${process.env.PORT ?? 1234}`);
