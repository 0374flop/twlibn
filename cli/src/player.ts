import { ChunkType } from "@twlibn/demo";
import { parseDemoMessage } from "@twlibn/message";
import { Snapshot } from "@twlibn/snapshot";
import { MapParser } from "@twlibn/map";
import { MapRenderer, PlayerPos, attachCameraControls } from "./render";

interface ParsedDemo {
	chunks: any[];
	map_data: Buffer;
}

export function playDemo(demo: ParsedDemo): void {
	const map = MapParser.parse(demo.map_data);
	if (!map.game_layer || !map.game_layer.tiles) {
		console.error("no game layer in demo");
		return;
	}

	const tiles = map.game_layer.tiles.map(row => row.map((t: { id: number }) => t.id));
	const front = map.front_layer?.tiles?.map(row => row.map((t: { id: number }) => t.id));
	const renderer = new MapRenderer(tiles, front);
	attachCameraControls(renderer);
	renderer.render();

	const snap = new Snapshot();
	const names = new Map<number, string>();
	let startTick = -1;
	let cur_tick = 0;
	let deltatick = -1;
	const startTime = Date.now();

	const updateNames = () => {
		for (const item of snap.deltas) {
			if (item.type_id === 11) {
				names.set(item.id, (item.parsed as { name: string }).name);
			}
		}
	};

	for (const chunk of demo.chunks) {
		if (chunk.kind === "tick") {
			cur_tick = chunk.tick;
			if (startTick === -1) startTick = cur_tick;
			continue;
		}
		if (chunk.kind !== "chunk") continue;

		if (chunk.type === ChunkType.Snapshot) {
			snap.unpackFullSnapshot(chunk.data, cur_tick);
			deltatick = cur_tick;
			updateNames();
		} else if (chunk.type === ChunkType.SnapshotDelta) {
			snap.unpackSnapshot(chunk.data, deltatick, cur_tick);
			deltatick = cur_tick;
			updateNames();

			const tick = cur_tick;
			const delay = ((tick - startTick) / 50) * 1000 - (Date.now() - startTime);
			const players: PlayerPos[] = [];
			for (const item of snap.deltas) {
				if (item.type_id === 9) {
					const c = (item.parsed as { character_core: { x: number; y: number; angle: number }; client_id: number }).character_core;
					const cid = (item.parsed as { client_id: number }).client_id;
					players.push({ x: c.x, y: c.y, angle: c.angle, name: names.get(cid) ?? `#${cid}` });
				}
			}
			setTimeout(() => {
				renderer.setPlayers(players);
				renderer.render();
			}, Math.max(0, delay));
		} else if (chunk.type === ChunkType.Message) {
			try {
				const msg = parseDemoMessage(chunk.data);
				if (msg.kind !== "SvChat") continue;
				const tick = cur_tick;
				const delay = ((tick - startTick) / 50) * 1000 - (Date.now() - startTime);
				const captured = { client_id: msg.client_id, team: msg.team, message: msg.message };
				const capturedNames = new Map(names);
				setTimeout(() => {
					let line: string;
					if (captured.client_id === -1) {
						line = `*** ${captured.message}`;
					} else {
						const name = capturedNames.get(captured.client_id) ?? `#${captured.client_id}`;
						const team = captured.team === 0 ? "" : captured.team;
						line = `${captured.client_id}:${team} ${name} : ${captured.message}`;
					}
					renderer.pushChat(line);
					renderer.render();
				}, Math.max(0, delay));
			} catch (e) {
				// skip
			}
		}
	}
}
