import { Cell, Camera, Layer } from "./index";

const ANSI_RESET = "\x1b[0m";
const COLOR_YELLOW = "\x1b[33m";
const COLOR_WHITE = "\x1b[37m";

function emptyRow(width: number): Cell[] {
	return Array.from({ length: width }, () => ({ char: "\0", color: "" }));
}

export class ChatLayer implements Layer {
	readonly parallax = 0;
	private lines: string[] = [];
	private maxLines = 5;

	push(line: string): void {
		this.lines.push(line);
		while (this.lines.length > this.maxLines) this.lines.shift();
	}

	clear(): void {
		this.lines = [];
	}

	render(_camera: Camera, width: number, height: number): Cell[][] {
		const grid: Cell[][] = [];
		for (let r = 0; r < height; r++) grid.push(emptyRow(width));

		for (let i = 0; i < this.lines.length; i++) {
			const line = this.lines[i];
			const color = line.startsWith("***") ? COLOR_YELLOW : COLOR_WHITE;
			for (let c = 0; c < Math.min(line.length, width); c++) {
				grid[i][c] = { char: line[c], color };
			}
		}

		return grid;
	}
}

export class HudLayer implements Layer {
	readonly parallax = 0;
	private lines: string[] = [];

	setLines(lines: string[]): void {
		this.lines = lines;
	}

	render(_camera: Camera, width: number, height: number): Cell[][] {
		const grid: Cell[][] = [];
		for (let r = 0; r < height; r++) grid.push(emptyRow(width));

		for (let i = 0; i < this.lines.length && i < height; i++) {
			const line = this.lines[i];
			for (let c = 0; c < Math.min(line.length, width); c++) {
				grid[i][c] = { char: line[c], color: COLOR_WHITE };
			}
		}

		return grid;
	}
}

export class StatusLayer implements Layer {
	readonly parallax = 0;
	private text = "";

	setText(text: string): void {
		this.text = text;
	}

	render(_camera: Camera, width: number, height: number): Cell[][] {
		const grid: Cell[][] = [];
		for (let r = 0; r < height; r++) grid.push(emptyRow(width));

		const last = height - 1;
		const bg = "\x1b[7m";
		const line = this.text.slice(0, width).padEnd(width);
		for (let c = 0; c < width; c++) {
			grid[last][c] = { char: line[c], color: "", bg };
		}

		return grid;
	}
}

export class MenuLayer implements Layer {
	readonly parallax = 0;
	private visible = false;
	private items: string[] = [];
	private selected = 0;

	show(items: string[]): void {
		this.items = items;
		this.selected = 0;
		this.visible = true;
	}

	hide(): void {
		this.visible = false;
	}

	isVisible(): boolean {
		return this.visible;
	}

	next(): void { this.selected = (this.selected + 1) % this.items.length; }
	prev(): void { this.selected = (this.selected - 1 + this.items.length) % this.items.length; }
	getSelected(): number { return this.selected; }
	getItem(): string { return this.items[this.selected]; }

	render(_camera: Camera, width: number, height: number): Cell[][] {
		const grid: Cell[][] = [];
		for (let r = 0; r < height; r++) grid.push(emptyRow(width));
		if (!this.visible) return grid;

		const menuW = Math.min(30, width - 4);
		const menuH = this.items.length + 2;
		const startR = Math.floor((height - menuH) / 2);
		const startC = Math.floor((width - menuW) / 2);

		for (let r = 0; r < menuH && startR + r < height; r++) {
			for (let c = 0; c < menuW && startC + c < width; c++) {
				const isTop = r === 0;
				const isBot = r === menuH - 1;
				const isLeft = c === 0;
				const isRight = c === menuW - 1;
				let char = " ";
				if (isTop && isLeft) char = "┌";
				else if (isTop && isRight) char = "┐";
				else if (isBot && isLeft) char = "└";
				else if (isBot && isRight) char = "┘";
				else if (isTop || isBot) char = "─";
				else if (isLeft || isRight) char = "│";
				else {
					const itemIdx = r - 1;
					if (itemIdx < this.items.length) {
						const item = this.items[itemIdx];
						const textC = c - 1;
						if (textC < item.length) char = item[textC];
					}
				}
				const isSelectedRow = r - 1 === this.selected;
				const color = isSelectedRow && !isTop && !isBot ? "\x1b[7m" : COLOR_WHITE;
				grid[startR + r][startC + c] = { char, color };
			}
		}

		return grid;
	}
}
