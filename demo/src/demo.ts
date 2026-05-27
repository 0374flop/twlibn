import { DemoChunk, DemoHeader, DataChunk, TickChunk, ParsedDemo, TimelineMarkers, ChunkType } from "@twlibn/types";
import { BufReader } from "@twlibn/core";

export class DemoParser {
	static parse(buf: Buffer): ParsedDemo {
		const r = new BufReader(buf);

		const header = this.parse_header(r);
		const timeline = header.version >= 4 ? this.parse_timeline(r) : undefined;
		if (header.version >= 6) this.parse_sha256_ext(r);
		const map_data = r.raw(header.map_size);
		const chunks = this.parse_chunks(r, header.version);

		return { header, timeline, map_data, chunks };
	}

	private static parse_header(r: BufReader): DemoHeader {
		const magic = r.cstring(7);
		if (magic !== "TWDEMO") throw new Error(`Invalid demo magic: "${magic}"`);

		const version = r.u8();
		if (version < 3 || version > 6) throw new Error(`Unsupported demo version: ${version}`);

		return {
			magic,
			version,
			net_version: r.cstring(64),
			map_name: r.cstring(64),
			map_size: r.i32be(),
			map_crc: r.i32be(),
			type: r.cstring(8) as "client" | "server",
			length: r.i32be(),
			timestamp: r.cstring(20),
		};
	}

	private static readonly SHA256_EXT_UUID = Buffer.from(
		"6be6da4acebd380c9b5b1289c842d780", "hex"
	);

	private static parse_sha256_ext(r: BufReader): void {
		const uuid = r.raw(16);
		if (uuid.compare(this.SHA256_EXT_UUID) === 0) {
			r.raw(32);
		} else {
			r.pos -= 16;
		}
	}

	private static parse_timeline(r: BufReader): TimelineMarkers {
		const count = r.i32be();
		const all: number[] = [];
		for (let i = 0; i < 64; i++) all.push(r.i32be());
		return { count, markers: all.slice(0, count) };
	}

	private static parse_chunks(r: BufReader, version: number): DemoChunk[] {
		const chunks: DemoChunk[] = [];
		let current_tick = 0;

		while (r.remaining > 0) {
			const first = r.u8();

			if (first & 0x80) {
				const chunk = version <= 4
					? this.parse_tick_v34(r, first, current_tick)
					: this.parse_tick_v5(r, first, current_tick);

				current_tick = chunk.tick;
				chunks.push(chunk);
			} else {
				chunks.push(this.parse_data_chunk(r, first));
			}
		}

		return chunks;
	}

	private static parse_tick_v34(r: BufReader, first: number, prev_tick: number): TickChunk {
		const keyframe = !!(first & 0x40);
		const delta    = first & 0x3f;

		if (delta === 0) {
			return { kind: "tick", keyframe, tick: r.i32be(), delta: false };
		}

		return { kind: "tick", keyframe, tick: prev_tick + delta, delta: true };
	}

	private static parse_tick_v5(r: BufReader, first: number, prev_tick: number): TickChunk {
		const keyframe = !!(first & 0x40);
		const inline_tick = !!(first & 0x20);
		const delta = first & 0x1f;

		if (inline_tick) {
			return { kind: "tick", keyframe, tick: prev_tick + delta, delta: true };
		}

		return { kind: "tick", keyframe, tick: r.i32be(), delta: false };
	}

	private static parse_data_chunk(r: BufReader, first: number): DataChunk {
		const type = ((first & 0x60) >> 5) as ChunkType;
		let size = first & 0x1f;

		if (size === 30) size = r.u8();
		else if (size === 31) size = r.u16le();

		return { kind: "chunk", type, data: r.raw(size) };
	}
}

export default DemoParser;