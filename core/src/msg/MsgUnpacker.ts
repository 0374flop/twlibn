import { VarIntReader } from '../utils/varint';

export class MsgUnpacker {
	private reader: VarIntReader;

	constructor(pSrc: Buffer) {
		this.reader = new VarIntReader(pSrc);
	}

	unpackInt(): number {
		return this.reader.readInt();
	}

	unpackString(): string {
		const start = this.reader.pos;
		const end = this.reader.buf.indexOf(0, start);
		const result = this.reader.buf.subarray(start, end === -1 ? this.reader.buf.length : end).toString('utf8');
		this.reader.pos = (end === -1 ? this.reader.buf.length : end) + 1;
		return result;
	}

	/** @param size - size in bytes */
	unpackRaw(size: number): Buffer {
		const result = this.reader.buf.subarray(this.reader.pos, this.reader.pos + size);
		this.reader.pos += size;
		return result;
	}

	get remaining(): number {
		return this.reader.remaining;
	}
}