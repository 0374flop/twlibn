import * as readline from "readline";
import { Client } from "teeworlds";
import { MapParser } from "@twlibn/map";
import { Renderer } from "./renderer/index";
import { MapLayer, PlayersLayer, PlayerPos } from "./renderer/game";
import { ChatLayer, StatusLayer } from "./renderer/ui";

export function liveView(host: string, port: number, name: string): void {
	const client = new Client(host, port, name, { downloadMap: true });

	const renderer = new Renderer();
	const mapLayer = new MapLayer();
	const playersLayer = new PlayersLayer();
	const chatLayer = new ChatLayer();
	const statusLayer = new StatusLayer();

	renderer.add(mapLayer);
	renderer.add(playersLayer);
	renderer.add(chatLayer);
	renderer.add(statusLayer);

	let mapSize = 0;
	let mapReady = false;
	let manualFollow = false;
	let followCid: number | null = null;

	const updateStatus = () => {
		const snap = client.SnapshotUnpacker;
		const ownId = snap.OwnID;
		const followedName = followCid !== null
			? (snap.getObjClientInfo(followCid)?.name ?? `#${followCid}`)
			: "free";

		let mapStr: string;
		if (mapReady) {
			mapStr = "map: loaded";
		} else if (mapSize > 0 && client.map) {
			const pct = Math.min(100, Math.floor(client.map.mapBuffer.length / mapSize * 100));
			mapStr = `map: ${pct}%`;
		} else {
			mapStr = "map: waiting...";
		}

		statusLayer.setText(`${mapStr}  following: ${followedName}  [WASD] move  [Q/E] player  [T] quit`);
	};

	const updateCamera = () => {
		if (followCid === null) return;
		const char = client.SnapshotUnpacker.getObjCharacter(followCid);
		if (!char) return;
		const px = Math.floor(char.character_core.x / 32);
		const py = Math.floor(char.character_core.y / 32);
		const w = process.stdout.columns ?? 80;
		const h = (process.stdout.rows ?? 26) - 1;
		renderer.camera.x = px - Math.floor(w / 2);
		renderer.camera.y = py - Math.floor(h / 2);
	};

	const render = () => {
		updateStatus();
		renderer.render();
	};

	client.on("map_details", (details) => {
		mapSize = details.map_size;
	});

	client.on("connected", () => {
		render();
	});

	client.on("snapshot", () => {
		client.movement.input.m_TargetX ^= 1;
		if (!mapReady && client.map && client.map.mapBuffer.length > 0 && client.map.mapBuffer.length >= mapSize && mapSize > 0) {
			try {
				const map = MapParser.parse(client.map.mapBuffer);
				if (map.game_layer?.tiles) {
					const tiles = map.game_layer.tiles.map(row => row.map((t: { id: number }) => t.id));
					const front = map.front_layer?.tiles?.map(row => row.map((t: { id: number }) => t.id));
					mapLayer.setTiles(tiles, front);
					mapReady = true;
				}
			} catch (_) {}
		}

		const snap = client.SnapshotUnpacker;
		const ownId = snap.OwnID;
		if (followCid === null && ownId !== undefined && !manualFollow) {
			followCid = ownId;
		}

		const players: PlayerPos[] = snap.AllObjCharacter.map(char => {
			const info = snap.getObjClientInfo(char.client_id);
			return {
				x: char.character_core.x,
				y: char.character_core.y,
				angle: char.character_core.angle,
				name: info?.name ?? `#${char.client_id}`,
				cid: char.client_id,
			};
		});

		playersLayer.setPlayers(players);
		updateCamera();
		render();
	});

	client.on("message", (msg) => {
		if (msg.client_id === -1) {
			chatLayer.push(`*** ${msg.message}`);
		} else {
			const name = msg.author?.ClientInfo?.name ?? `#${msg.client_id}`;
			const team = msg.team === 0 ? "" : msg.team;
			chatLayer.push(`${msg.client_id}:${team} ${name} : ${msg.message}`);
		}
	});

	client.on("disconnect", (reason) => {
		renderer.destroy();
		console.log(`Disconnected: ${reason}`);
		process.exit(0);
	});

	const switchPlayer = (dir: 1 | -1) => {
		manualFollow = true;
		const players = client.SnapshotUnpacker.AllObjCharacter.slice().sort((a, b) => a.client_id - b.client_id);
		if (players.length === 0) return;
		const idx = followCid !== null ? players.findIndex(p => p.client_id === followCid) : -1;
		followCid = players[(idx + dir + players.length) % players.length].client_id;
		render();
	};

	const cleanup = async () => {
		renderer.destroy();
		try { await client.Disconnect(); } catch (_) {}
		process.exit(0);
	};

	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY) process.stdin.setRawMode(true);

	const TARGET_STEP = 200;
	let hookOn = false;

	process.stdin.on("keypress", (_str, key) => {
		if (!key) return;
		if (key.name === "t" || (key.ctrl && key.name === "c")) { cleanup(); return; }
		if (key.name === "q") { switchPlayer(-1); return; }
		if (key.name === "e") { switchPlayer(1); return; }

		const inp = client.movement.input;

		if (key.name === "a") { inp.m_Direction = inp.m_Direction === -1 ? 0 : -1; return; }
		if (key.name === "d") { inp.m_Direction = inp.m_Direction === 1 ? 0 : 1; return; }
		if (key.name === "space") { inp.m_Jump = 1; setTimeout(() => { inp.m_Jump = 0; }, 50); return; }
		if (key.name === "x") { hookOn = !hookOn; inp.m_Hook = hookOn ? 1 : 0; return; }

		if (key.name === "h") { inp.m_TargetY += TARGET_STEP; return; }
		if (key.name === "g") { inp.m_TargetX -= TARGET_STEP; return; }
		if (key.name === "j") { inp.m_TargetX += TARGET_STEP; return; }
		if (key.name === "y") { inp.m_TargetY -= TARGET_STEP; return; }

		const moves: Record<string, [number, number]> = {
			up: [0, -4], down: [0, 4], left: [-4, 0], right: [4, 0],
			w: [0, -4], s: [0, 4],
		};
		const mv = moves[key.name ?? ""];
		if (mv) { manualFollow = true; followCid = null; renderer.moveCamera(mv[0], mv[1]); render(); }
	});

	process.on("SIGINT", cleanup);

	client.connect();
}
