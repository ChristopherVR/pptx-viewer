#!/usr/bin/env bun
/**
 * Yjs-compatible WebSocket collaboration server for the PPTX Viewer demo.
 *
 * Speaks the y-websocket binary protocol (sync, awareness, auth messages)
 * so it is fully compatible with y-websocket's `WebsocketProvider`.
 *
 * Usage:
 *   bun run collab           # from repo root
 *   bun demo/collab-server.mjs
 *   PORT=4000 bun demo/collab-server.mjs
 *
 * Collaborators can join at:
 *   http://localhost:4173/?room=<session-id>&server=ws://localhost:1234
 */

import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

// Message type constants (must match y-websocket client)
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
// const MESSAGE_AUTH = 2;  // not used by the server

const PORT = parseInt(process.env.PORT || '1234', 10);

// ---------------------------------------------------------------------------
// Room management
// ---------------------------------------------------------------------------

/** @type {Map<string, { doc: Y.Doc, awareness: awarenessProtocol.Awareness, clients: Set<any> }>} */
const rooms = new Map();

function getOrCreateRoom(name) {
	if (rooms.has(name)) {
		return rooms.get(name);
	}
	const doc = new Y.Doc();
	const awareness = new awarenessProtocol.Awareness(doc);
	// Clean up awareness state when a client is removed
	awareness.on('update', ({ added, updated, removed }, origin) => {
		const changedClients = added.concat(updated).concat(removed);
		const room = rooms.get(name);
		if (!room) {
			return;
		}
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
		encoding.writeVarUint8Array(
			encoder,
			awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
		);
		const msg = encoding.toUint8Array(encoder);
		const buf = msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength);
		for (const client of room.clients) {
			if (client !== origin) {
				try {
					client.send(buf);
				} catch {
					/* client gone */
				}
			}
		}
	});
	const room = { doc, awareness, clients: new Set() };
	rooms.set(name, room);
	return room;
}

function removeClient(room, roomName, ws) {
	room.clients.delete(ws);
	// Remove awareness states for this client
	if (ws._clientId !== undefined && ws._clientId !== null) {
		awarenessProtocol.removeAwarenessStates(room.awareness, [ws._clientId], null);
	}
	if (room.clients.size === 0) {
		room.awareness.destroy();
		room.doc.destroy();
		rooms.delete(roomName);
		console.log(`[collab-server] Room destroyed: ${roomName}`);
	}
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

function handleMessage(room, ws, data) {
	const buf = new Uint8Array(data);
	const decoder = decoding.createDecoder(buf);
	const messageType = decoding.readVarUint(decoder);

	switch (messageType) {
		case MESSAGE_SYNC: {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, MESSAGE_SYNC);
			const syncType = syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
			if (encoding.length(encoder) > 1) {
				const reply = encoding.toUint8Array(encoder);
				try {
					ws.send(reply.buffer.slice(reply.byteOffset, reply.byteOffset + reply.byteLength));
				} catch {
					/* */
				}
			}
			// If this was a sync step 2 or update, broadcast to other clients
			if (
				syncType === syncProtocol.messageYjsSyncStep2 ||
				syncType === syncProtocol.messageYjsUpdate
			) {
				const broadcastBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
				for (const client of room.clients) {
					if (client !== ws) {
						try {
							client.send(broadcastBuf);
						} catch {
							/* client gone */
						}
					}
				}
			}
			break;
		}
		case MESSAGE_AWARENESS: {
			const update = decoding.readVarUint8Array(decoder);
			awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
			break;
		}
		default:
			console.warn(`[collab-server] Unknown message type: ${messageType}`);
	}
}

// ---------------------------------------------------------------------------
// File storage — stores PPTX content per room so joiners can download it
// ---------------------------------------------------------------------------

/** @type {Map<string, Uint8Array>} */
const roomFiles = new Map();

// ---------------------------------------------------------------------------
// Server (Bun.serve with WebSocket upgrade + HTTP file transfer)
// ---------------------------------------------------------------------------

const collabServer = Bun.serve({
	port: PORT,
	async fetch(req, srv) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		// CORS headers for cross-origin requests from the demo
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle CORS preflight
		if (req.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		// POST /file/:roomId — upload PPTX content for a room
		if (req.method === 'POST' && pathname.startsWith('/file/')) {
			const roomId = decodeURIComponent(pathname.slice(6));
			const body = await req.arrayBuffer();
			roomFiles.set(roomId, new Uint8Array(body));
			console.log(`[collab-server] File stored for room: ${roomId} (${body.byteLength} bytes)`);
			return new Response(JSON.stringify({ ok: true }), {
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}

		// GET /file/:roomId — download PPTX content for a room
		if (req.method === 'GET' && pathname.startsWith('/file/')) {
			const roomId = decodeURIComponent(pathname.slice(6));
			const content = roomFiles.get(roomId);
			if (!content) {
				return new Response('Not found', { status: 404, headers: corsHeaders });
			}
			console.log(`[collab-server] File served for room: ${roomId} (${content.byteLength} bytes)`);
			return new Response(content, {
				headers: {
					'Content-Type': 'application/octet-stream',
					'Content-Disposition': `attachment; filename="${roomId}.pptx"`,
					...corsHeaders,
				},
			});
		}

		// WebSocket upgrade — room name from the URL path
		const roomName = decodeURIComponent(pathname.slice(1)) || 'default';
		const upgraded = srv.upgrade(req, { data: { roomName } });
		if (!upgraded) {
			return new Response('WebSocket upgrade required', { status: 426, headers: corsHeaders });
		}
		return undefined;
	},
	websocket: {
		open(ws) {
			const roomName = ws.data.roomName;
			const room = getOrCreateRoom(roomName);
			room.clients.add(ws);
			console.log(
				`[collab-server] Client connected to room: ${roomName} (${room.clients.size} client${room.clients.size !== 1 ? 's' : ''})`,
			);

			try {
				// Send sync step 1 to the new client so they get the current doc state
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, MESSAGE_SYNC);
				syncProtocol.writeSyncStep1(encoder, room.doc);
				const syncMsg = encoding.toUint8Array(encoder);
				ws.send(syncMsg.buffer.slice(syncMsg.byteOffset, syncMsg.byteOffset + syncMsg.byteLength));

				// Send current awareness states
				const awarenessStates = room.awareness.getStates();
				if (awarenessStates.size > 0) {
					const awarenessEncoder = encoding.createEncoder();
					encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
					encoding.writeVarUint8Array(
						awarenessEncoder,
						awarenessProtocol.encodeAwarenessUpdate(
							room.awareness,
							Array.from(awarenessStates.keys()),
						),
					);
					const awarenessMsg = encoding.toUint8Array(awarenessEncoder);
					ws.send(
						awarenessMsg.buffer.slice(
							awarenessMsg.byteOffset,
							awarenessMsg.byteOffset + awarenessMsg.byteLength,
						),
					);
				}
			} catch (e) {
				console.error(`[collab-server] Error sending initial sync:`, e);
			}
		},
		message(ws, data) {
			const roomName = ws.data.roomName;
			const room = rooms.get(roomName);
			if (!room) {
				return;
			}

			// Track client ID from awareness messages for cleanup
			try {
				const buf = new Uint8Array(data);
				const decoder = decoding.createDecoder(buf);
				const msgType = decoding.readVarUint(decoder);
				if (msgType === MESSAGE_AWARENESS) {
					const update = decoding.readVarUint8Array(decoder);
					const updateDecoder = decoding.createDecoder(update);
					const len = decoding.readVarUint(updateDecoder);
					if (len > 0) {
						ws._clientId = decoding.readVarUint(updateDecoder);
					}
				}
			} catch {
				// Ignore errors during client ID extraction
			}

			handleMessage(room, ws, data);
		},
		close(ws) {
			const roomName = ws.data.roomName;
			const room = rooms.get(roomName);
			if (room) {
				removeClient(room, roomName, ws);
				console.log(
					`[collab-server] Client disconnected from room: ${roomName} (${room.clients.size} remaining)`,
				);
			}
		},
	},
});

console.log(
	`[collab-server] Yjs collaboration server running on ws://localhost:${collabServer.port}`,
);
console.log(`[collab-server] Share this URL with collaborators:`);
console.log(
	`  http://localhost:4173/?room=<session-id>&server=ws://localhost:${collabServer.port}`,
);
console.log('');
