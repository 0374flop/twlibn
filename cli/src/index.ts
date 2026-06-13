#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { DemoParser, ChunkType } from "@twlibn/demo";
import { parseDemoMessage } from "@twlibn/message";
import { Snapshot } from "@twlibn/snapshot";
import { MapParser } from "@twlibn/map";

const program = new Command();

program
	.name("twlibn")
	.description("twlibn cli")
	.version("0.0.1");

program
	.command("demo <file>")
	.description("parse demo file")
	.option("-m, --messages", "print parsed messages")
	.option("-c, --chat", "print chat messages only")
	.option("-s, --snapshots", "print snapshot item counts per tick")
	.option("-t, --tick <n>", "print snapshot items for specific tick", parseInt)
	.action((file: string, opts: { messages?: boolean; chat?: boolean; snapshots?: boolean; tick?: number }) => {
		const buf = fs.readFileSync(path.resolve(file));
		const demo = DemoParser.parse(buf);
		const h = demo.header;

		console.log("=== header ===");
		console.log(`version:     ${h.version}`);
		console.log(`net_version: ${h.net_version}`);
		console.log(`map:         ${h.map_name} (crc=${h.map_crc}, size=${h.map_size})`);
		console.log(`type:        ${h.type}`);
		console.log(`length:      ${h.length}`);
		console.log(`timestamp:   ${h.timestamp}`);

		if (demo.timeline) {
			console.log(`markers:     ${demo.timeline.count}`);
		}

		const ticks = demo.chunks.filter(c => c.kind === "tick").length;
		const snaps = demo.chunks.filter(c => c.kind === "chunk" && c.type === ChunkType.Snapshot).length;
		const deltas = demo.chunks.filter(c => c.kind === "chunk" && c.type === ChunkType.SnapshotDelta).length;
		const msgs = demo.chunks.filter(c => c.kind === "chunk" && c.type === ChunkType.Message).length;

		console.log("\n=== chunks ===");
		console.log(`ticks:           ${ticks}`);
		console.log(`snapshots:       ${snaps}`);
		console.log(`snapshot deltas: ${deltas}`);
		console.log(`messages:        ${msgs}`);

		if (opts.messages || opts.chat) {
			console.log("\n=== messages ===");
			for (const chunk of demo.chunks) {
				if (chunk.kind !== "chunk" || chunk.type !== ChunkType.Message) continue;
				try {
					const msg = parseDemoMessage(chunk.data);
					if (msg.kind === "Unknown") continue;
					if (opts.chat && msg.kind !== "SvChat") continue;
					if (opts.chat && msg.kind === "SvChat") {
						if (msg.client_id === -1) {
							console.log(`*** ${msg.message}`);
						} else {
							console.log(`${msg.client_id}:${msg.team === 0 ? "" : msg.team} name : ${msg.message}`);
						}
						continue;
					}
					console.log(JSON.stringify(msg));
				} catch (e) {
					console.log(`[parse error] ${e}`);
				}
			}
		}

		if (opts.snapshots || opts.tick !== undefined) {
			console.log("\n=== snapshots ===");
			const snap = new Snapshot();
			let cur_tick = 0;
			let deltatick = -1;

			for (const chunk of demo.chunks) {
				if (chunk.kind === "tick") {
					cur_tick = chunk.tick;
					continue;
				}
				if (chunk.kind !== "chunk") continue;

				if (chunk.type === ChunkType.Snapshot) {
					const { items } = snap.unpackFullSnapshot(chunk.data, cur_tick);
					deltatick = cur_tick;

					if (opts.tick !== undefined && cur_tick === opts.tick) {
						console.log(`tick ${cur_tick} (full):`);
						for (const item of items) {
							console.log(`  type=${item.type_id} id=${item.id}`, JSON.stringify(item.parsed));
						}
					} else if (opts.snapshots) {
						console.log(`tick ${cur_tick} (full): ${items.length} items`);
					}
				} else if (chunk.type === ChunkType.SnapshotDelta) {
					const result = snap.unpackSnapshot(chunk.data, deltatick, cur_tick);
					deltatick = cur_tick;

					if (opts.tick !== undefined && cur_tick === opts.tick) {
						console.log(`tick ${cur_tick} (delta):`);
						for (const item of result.items) {
							console.log(`  type=${item.type_id} id=${item.id}`, JSON.stringify(item.parsed));
						}
					} else if (opts.snapshots) {
						console.log(`tick ${cur_tick} (delta): ${result.items.length} items`);
					}
				}
			}
		}
	});

program
	.command("map <file>")
	.description("parse map file")
	.option("-g, --groups", "print groups and layers")
	.option("-i, --images", "print images")
	.option("-e, --envelopes", "print envelopes")
	.action((file: string, opts: { groups?: boolean; images?: boolean; envelopes?: boolean }) => {
		const buf = fs.readFileSync(path.resolve(file));
		const map = MapParser.parse(buf);

		console.log("=== map ===");
		console.log(`datafile version: ${map.datafile_version}`);
		if (map.info) {
			const i = map.info;
			if (i.author)  console.log(`author:  ${i.author}`);
			if (i.version) console.log(`version: ${i.version}`);
			if (i.credits) console.log(`credits: ${i.credits}`);
			if (i.license) console.log(`license: ${i.license}`);
			if (i.settings.length) console.log(`settings (${i.settings.length}):`);
			for (const s of i.settings) console.log(`  ${s}`);
		}
		console.log(`groups:    ${map.groups.length}`);
		console.log(`images:    ${map.images.length}`);
		console.log(`sounds:    ${map.sounds.length}`);
		console.log(`envelopes: ${map.envelopes.length}`);

		if (map.game_layer) {
			const g = map.game_layer;
			console.log(`size:      ${g.width}x${g.height}`);
		}

		if (opts.groups) {
			console.log("\n=== groups ===");
			for (const g of map.groups) {
				console.log(`  [${g.name || "(unnamed)"}] layers=${g.layers.length} offset=(${g.x_offset},${g.y_offset}) parallax=(${g.x_parallax},${g.y_parallax})`);
				for (const l of g.layers) {
					if ("layer_type" in l) {
						console.log(`    tile  [${l.name || "(unnamed)"}] ${l.width}x${l.height} type=${l.layer_type}`);
					} else if ("quads" in l) {
						console.log(`    quad  [${l.name || "(unnamed)"}] quads=${l.quads.length}`);
					} else if ("sources" in l) {
						console.log(`    sound [${l.name || "(unnamed)"}] sources=${l.sources.length}`);
					}
				}
			}
		}

		if (opts.images) {
			console.log("\n=== images ===");
			for (let i = 0; i < map.images.length; i++) {
				const img = map.images[i];
				console.log(`  [${i}] ${img.name} ${img.width}x${img.height}${img.external ? " (external)" : ""}`);
			}
		}

		if (opts.envelopes) {
			console.log("\n=== envelopes ===");
			for (let i = 0; i < map.envelopes.length; i++) {
				const e = map.envelopes[i];
				console.log(`  [${i}] ${e.name || "(unnamed)"} channels=${e.channels} points=${e.points.length}`);
			}
		}
	});

program.parse(process.argv);
