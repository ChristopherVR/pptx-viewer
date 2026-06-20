/**
 * collab-server-hocuspocus.example.mjs
 *
 * Minimal Hocuspocus server that pairs with pptx-viewer's built-in
 * collaboration stack (Yjs + y-websocket protocol).
 *
 * Prerequisites:
 *   npm install @hocuspocus/server @hocuspocus/extension-database
 *
 * Run:
 *   node demos/collab-server-hocuspocus.example.mjs
 *
 * Then point every viewer client at:
 *   serverUrl: 'ws://localhost:1234'
 *   roomId:    '<document-id>'
 *
 * Security note: the `authenticate` hook below enforces a bearer-token
 * contract. Replace the stub with real validation (JWT, session lookup,
 * database query, etc.) before shipping to production.
 */

import { Server } from '@hocuspocus/server';

// ---------------------------------------------------------------------------
// Auth contract
//
// Clients pass `authToken` in CollaborationConfig; y-websocket forwards it as
// a `token` query parameter when it opens the websocket. Hocuspocus surfaces
// it in `data.token` inside the `authenticate` hook.
// ---------------------------------------------------------------------------

/** @param {string} token */
async function validateToken(token) {
	// TODO: replace with your real auth (JWT verify, session DB lookup, etc.)
	if (!token || token === 'INVALID') {
		throw new Error('Unauthorized');
	}
	// Return arbitrary context that will be available in all subsequent hooks.
	return { userId: 'user-from-token' };
}

// ---------------------------------------------------------------------------
// Optional: persistence via a database extension
//
// Uncomment + configure to persist Y.Doc state across server restarts.
// Any store that implements the `fetch` / `store` callbacks works.
// ---------------------------------------------------------------------------

// import { Database } from '@hocuspocus/extension-database';
//
// const persistence = new Database({
//   async fetch({ documentName }) {
//     // Return a Uint8Array snapshot for the document, or null to start fresh.
//     return await myDb.getYDocState(documentName);
//   },
//   async store({ documentName, state }) {
//     await myDb.setYDocState(documentName, state);
//   },
// });

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Server.configure({
	port: 1234,

	// extensions: [persistence],  // uncomment once database is configured

	async onAuthenticate(data) {
		const token = data.token ?? '';
		const context = await validateToken(token);
		// Context is forwarded to onLoadDocument, onStoreDocument, etc.
		return context;
	},

	async onConnect(data) {
		// data.context holds whatever onAuthenticate returned.
		console.log(`[hocuspocus] client connected to "${data.documentName}"`, data.context);
	},

	async onDisconnect(data) {
		console.log(`[hocuspocus] client disconnected from "${data.documentName}"`);
	},
});

await server.listen();
console.log('[hocuspocus] listening on ws://localhost:1234');
