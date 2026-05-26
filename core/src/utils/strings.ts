const decoder = new TextDecoder("utf-8");

export function intsToStr(ints: number[]): string {
	const bytes: number[] = [];
	for (const v of ints) {
		bytes.push(((v >> 24) & 0xff) - 128);
		bytes.push(((v >> 16) & 0xff) - 128);
		bytes.push(((v >>  8) & 0xff) - 128);
		bytes.push(( v & 0xff) - 128);
	}
	bytes.splice(-1, 1);
	return decoder.decode(new Uint8Array(bytes)).replace(/\0.*/g, "");
}

export function strToInts(str: string, slots: number): number[] {
	const maxBytes = slots * 4 - 1;
	const raw = Buffer.from(str, "utf8").subarray(0, maxBytes);
	const bytes = new Array(slots * 4).fill(0);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw[i] + 128;
	bytes[slots * 4 - 1] = 0;

	const ints: number[] = [];
	for (let i = 0; i < slots; i++) {
		ints.push(
			((bytes[i * 4] & 0xff) << 24) |
			((bytes[i * 4 + 1] & 0xff) << 16) |
			((bytes[i * 4 + 2] & 0xff) <<  8) |
			 (bytes[i * 4 + 3] & 0xff)
		);
	}
	return ints;
}
