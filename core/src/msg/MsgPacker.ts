import { packInt } from '../utils/varint';

export class MsgPacker {
	result: Buffer;
	sys: boolean;
	flag: number;
	constructor(msg: number, sys: boolean, flag: number) {
		this.result = Buffer.from([2*msg + (sys ? 1 : 0)]);
		this.sys = sys;
		this.flag = flag;
	}
	AddString(str: string) {
		this.result = Buffer.concat([this.result, Buffer.from(str), Buffer.from([0x00])]);
	}
	AddBuffer(buffer: Buffer) {
		this.result = Buffer.concat([this.result, buffer]);
	}
	AddInt(i: number) {
		this.result = Buffer.concat([this.result, packInt(i)]);
	}
	get size() {
		return this.result.byteLength;
	}
	get buffer() {
		return this.result;
	}
}