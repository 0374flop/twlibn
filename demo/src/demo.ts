export interface DemoHeader {
	magic: string;
	version: number;
	net_version: string;
	map_name: string;
	map_size: number;
	map_crc: number;
	type: "client" | "server" | string;
	length: number;
	timestamp: string;
}

export interface TimelineMarkers {
	count: number;
	markers: number[];
}

export const enum ChunkType {
	Invalid = 0,
	Snapshot = 1,
	Message = 2,
	SnapshotDelta = 3,
}

export interface TickChunk {
	kind: "tick";
	keyframe: boolean;
	tick: number;
	delta: boolean;
}

export interface DataChunk {
	kind: "chunk";
	type: ChunkType;
	data: Buffer;
}

export type DemoChunk = TickChunk | DataChunk;

export interface ParsedDemo {
	header: DemoHeader;
	timeline?: TimelineMarkers;
	map_data: Buffer;
	chunks: DemoChunk[];
}

class Reader {
	pos = 0;
	constructor(private buf: Buffer) {}

	raw(size: number): Buffer {
		const s = this.buf.subarray(this.pos, this.pos + size);
		this.pos += size;
		return s;
	}

	cstring(size: number): string {
		const raw = this.raw(size);
		const end = raw.indexOf(0);
		return raw.subarray(0, end === -1 ? size : end).toString("utf8");
	}

	i32be(): number { const v = this.buf.readInt32BE(this.pos);  this.pos += 4; return v; }
	u8(): number { return this.buf[this.pos++]; }
	u16le(): number { const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }

	get remaining(): number { return this.buf.length - this.pos; }
}

export class DemoParser {

	static parse(buf: Buffer): ParsedDemo {
		const r = new Reader(buf);

		const header = this.parse_header(r);
		const timeline = header.version >= 4 ? this.parse_timeline(r) : undefined;
		if (header.version >= 6) this.parse_sha256_ext(r);
		const map_data = r.raw(header.map_size);
		const chunks = this.parse_chunks(r, header.version);

		return { header, timeline, map_data, chunks };
	}

	private static parse_header(r: Reader): DemoHeader {
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

	private static parse_sha256_ext(r: Reader): void {
		const uuid = r.raw(16);
		if (uuid.compare(this.SHA256_EXT_UUID) === 0) {
			r.raw(32);
		} else {
			r.pos -= 16;
		}
	}

	private static parse_timeline(r: Reader): TimelineMarkers {
		const count = r.i32be();
		const all: number[] = [];
		for (let i = 0; i < 64; i++) all.push(r.i32be());
		return { count, markers: all.slice(0, count) };
	}

	private static parse_chunks(r: Reader, version: number): DemoChunk[] {
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

	private static parse_tick_v34(r: Reader, first: number, prev_tick: number): TickChunk {
		const keyframe = !!(first & 0x40);
		const delta    = first & 0x3f;

		if (delta === 0) {
			return { kind: "tick", keyframe, tick: r.i32be(), delta: false };
		}

		return { kind: "tick", keyframe, tick: prev_tick + delta, delta: true };
	}

	private static parse_tick_v5(r: Reader, first: number, prev_tick: number): TickChunk {
		const keyframe = !!(first & 0x40);
		const inline_tick = !!(first & 0x20);
		const delta = first & 0x1f;

		if (inline_tick) {
			return { kind: "tick", keyframe, tick: prev_tick + delta, delta: true };
		}

		return { kind: "tick", keyframe, tick: r.i32be(), delta: false };
	}

	private static parse_data_chunk(r: Reader, first: number): DataChunk {
		const type = ((first & 0x60) >> 5) as ChunkType;
		let size = first & 0x1f;

		if (size === 30) size = r.u8();
		else if (size === 31) size = r.u16le();

		return { kind: "chunk", type, data: r.raw(size) };
	}
}

export default DemoParser;