export class BufReader {
	pos = 0;
	constructor(readonly buf: Buffer) {}

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

	u8(): number { return this.buf[this.pos++]; }
	i32be(): number { const v = this.buf.readInt32BE(this.pos); this.pos += 4; return v; }
	u16le(): number { const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
	i32le(): number { const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }

	seek(pos: number): this { this.pos = pos; return this; }
	get remaining(): number { return this.buf.length - this.pos; }
}

export class BufWriter {
	private chunks: Buffer[] = [];

	raw(buf: Buffer): this { this.chunks.push(buf); return this; }
	u8(v: number): this { const b = Buffer.alloc(1); b[0] = v; return this.raw(b); }
	i32be(v: number): this { const b = Buffer.alloc(4); b.writeInt32BE(v); return this.raw(b); }
	u16le(v: number): this { const b = Buffer.alloc(2); b.writeUInt16LE(v); return this.raw(b); }
	i32le(v: number): this { const b = Buffer.alloc(4); b.writeInt32LE(v); return this.raw(b); }
	cstring(s: string, size: number): this {
		const b = Buffer.alloc(size, 0);
		Buffer.from(s, "utf8").copy(b, 0, 0, size - 1);
		return this.raw(b);
	}

	build(): Buffer { return Buffer.concat(this.chunks); }
	get size(): number { return this.chunks.reduce((a, c) => a + c.length, 0); }
}
