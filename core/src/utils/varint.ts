export class VarIntReader {
	pos = 0;
	constructor(readonly buf: Buffer) {}

	readInt(): number {
		let b = this.buf[this.pos++];
		const sign = (b >> 6) & 1;
		let v = b & 0x3f;

		if (b & 0x80) { b = this.buf[this.pos++]; v |= (b & 0x7f) << 6;
			if (b & 0x80) {
				b = this.buf[this.pos++]; v |= (b & 0x7f) << 13;
				if (b & 0x80) { 
					b = this.buf[this.pos++]; v |= (b & 0x7f) << 20;
					if (b & 0x80) { b = this.buf[this.pos++]; v |= (b & 0x0f) << 27; }
				} 
			}
		}

		return sign ? -(v + 1) : v;
	}

	readInts(n: number): number[] {
		const out: number[] = [];
		for (let i = 0; i < n; i++) out.push(this.readInt());
		return out;
	}

	get remaining(): number { return this.buf.length - this.pos; }
}

export function packInt(i: number): Buffer {
	const result: number[] = [];
	let dst = (i >> 25) & 0x40;
	i ^= (i >> 31);
	dst |= i & 0x3f;
	i >>= 6;
	if (i) {
		dst |= 0x80;
		result.push(dst);
		while (true) {
			dst = i & 0x7f;
			i >>= 7;
			dst |= (i !== 0 ? 1 : 0) << 7;
			result.push(dst);
			if (!i) break;
		}
	} else {
		result.push(dst);
	}
	return Buffer.from(result);
}

export function packInts(ints: number[]): Buffer {
	return Buffer.concat(ints.map(packInt));
}

export function varintToLE(buf: Buffer): Buffer {
	const r = new VarIntReader(buf);
	const ints: number[] = [];
	while (r.remaining > 0) ints.push(r.readInt());
	const out = Buffer.alloc(ints.length * 4);
	for (let i = 0; i < ints.length; i++) out.writeInt32LE(ints[i], i * 4);
	return out;
}