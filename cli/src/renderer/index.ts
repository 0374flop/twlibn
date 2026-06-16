export const ANSI_RESET = "\x1b[0m";

export interface Cell {
	char: string;
	color: string;
	bg?: string;
}

export interface Camera {
	x: number;
	y: number;
}

export interface Layer {
	parallax: number;
	render(camera: Camera, width: number, height: number): Cell[][];
}

function emptyGrid(width: number, height: number): Cell[][] {
	const grid: Cell[][] = [];
	for (let r = 0; r < height; r++) {
		grid.push(Array.from({ length: width }, () => ({ char: " ", color: "" })));
	}
	return grid;
}

function composite(base: Cell[][], over: Cell[][]): void {
	for (let r = 0; r < base.length && r < over.length; r++) {
		for (let c = 0; c < base[r].length && c < over[r].length; c++) {
			if (over[r][c].char !== "\0") base[r][c] = over[r][c];
		}
	}
}

export class Renderer {
	private layers: Layer[] = [];
	camera: Camera = { x: 0, y: 0 };
	private initialized = false;
	private draining = false;

	private write(s: string): void {
		const ok = process.stdout.write(s);
		if (!ok) this.draining = true;
	}

	private init(): void {
		this.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
		process.stdout.on("drain", () => { this.draining = false; });
		this.initialized = true;
	}

	add(layer: Layer): void {
		this.layers.push(layer);
	}

	remove(layer: Layer): void {
		const i = this.layers.indexOf(layer);
		if (i !== -1) this.layers.splice(i, 1);
	}

	render(): void {
		if (!this.initialized) this.init();
		if (this.draining) return;

		const width = process.stdout.columns ?? 80;
		const height = (process.stdout.rows ?? 26) - 1;

		const base = emptyGrid(width, height);

		for (const layer of this.layers) {
			const cam: Camera = {
				x: Math.round(this.camera.x * layer.parallax),
				y: Math.round(this.camera.y * layer.parallax),
			};
			const over = layer.render(cam, width, height);
			composite(base, over);
		}

		let out = "\x1b[?2026h\x1b[H";
		for (const row of base) {
			let line = "";
			let curColor = "";
			let curBg = "";
			for (const cell of row) {
				const color = cell.color ?? "";
				const bg = cell.bg ?? "";
				if (color !== curColor) { line += color; curColor = color; }
				if (bg !== curBg) { line += bg; curBg = bg; }
				line += cell.char;
			}
			out += line + ANSI_RESET + "\x1b[K\n";
		}
		out += "\x1b[J\x1b[?2026l";

		this.write(out);
	}

	moveCamera(dx: number, dy: number): void {
		this.camera.x += dx;
		this.camera.y += dy;
	}

	destroy(): void {
		this.write("\x1b[?25h\x1b[?1049l");
	}
}
