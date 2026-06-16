import { Cell, Camera, Layer, graphemes } from "./index";

const PLAYER_COLORS = [
	"\x1b[38;2;0;230;230m",
	"\x1b[38;2;60;220;60m",
	"\x1b[38;2;230;60;230m",
	"\x1b[38;2;230;200;0m",
	"\x1b[38;2;255;140;0m",
	"\x1b[38;2;230;50;50m",
	"\x1b[38;2;120;220;255m",
	"\x1b[38;2;140;255;120m",
];
const COLOR_WHITE = "\x1b[37m";

const TILE_CHARS: Record<number, string> = {
	0: " ", 1: "█", 2: "x", 3: "▒", 4: "L", 5: "c", 6: "t", 7: "J",
	9: "*", 10: "E", 11: "u", 12: "F", 13: "U", 14: "w", 15: "h",
	16: "W", 17: "e", 18: "E", 19: "H", 20: "h", 21: "o", 22: "O",
	33: ">", 34: "<", 192: "S", 193: "1", 194: "2",
};

const DIR_CHARS = [">", "\\", "v", "/", "<", "\\", "^", "/"];

function tileToChar(id: number): string {
	return TILE_CHARS[id] ?? "?";
}

function angleToChar(angle: number): string {
	const a = ((angle / 256) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
	return DIR_CHARS[Math.round(a / (Math.PI / 4)) % 8];
}

export interface PlayerPos {
	x: number;
	y: number;
	angle: number;
	name: string;
	cid: number;
}

export class MapLayer implements Layer {
	readonly parallax = 1;
	private tiles: number[][] = [];
	private front?: number[][];

	setTiles(tiles: number[][], front?: number[][]): void {
		this.tiles = tiles;
		this.front = front;
	}

	get mapWidth(): number { return this.tiles[0]?.length ?? 0; }
	get mapHeight(): number { return this.tiles.length; }

	render(camera: Camera, width: number, height: number): Cell[][] {
		const grid: Cell[][] = [];
		for (let row = 0; row < height; row++) {
			const cells: Cell[] = [];
			const mapRow = row + camera.y;
			for (let col = 0; col < width; col++) {
				const mapCol = col + camera.x;
				const f = this.front?.[mapRow]?.[mapCol] ?? 0;
				const id = f !== 0 ? f : (this.tiles[mapRow]?.[mapCol] ?? 0);
				cells.push({ char: tileToChar(id), color: COLOR_WHITE });
			}
			grid.push(cells);
		}
		return grid;
	}
}

export class PlayersLayer implements Layer {
	readonly parallax = 1;
	private players: PlayerPos[] = [];

	setPlayers(players: PlayerPos[]): void {
		this.players = players;
	}

	render(camera: Camera, width: number, height: number): Cell[][] {
		const grid: Cell[][] = [];
		for (let r = 0; r < height; r++) {
			grid.push(Array.from({ length: width }, () => ({ char: "\0", color: "" })));
		}

		for (const p of this.players) {
			const color = PLAYER_COLORS[p.cid % PLAYER_COLORS.length];
			const px = Math.floor(p.x / 32) - camera.x;
			const py = Math.floor(p.y / 32) - camera.y;

			if (py >= 0 && py < height && px >= 0 && px < width) {
				grid[py][px] = { char: angleToChar(p.angle), color };
			}
			const nameRow = py - 1;
			if (nameRow >= 0 && nameRow < height) {
				const nameChars = graphemes(p.name);
				for (let i = 0; i < nameChars.length; i++) {
					const col = px + i;
					if (col >= 0 && col < width) grid[nameRow][col] = { char: nameChars[i], color };
				}
			}
		}

		return grid;
	}
}
