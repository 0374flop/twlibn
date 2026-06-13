import * as readline from "readline";

const TILE_CHARS: Record<number, string> = {
  0: " ",
  1: "█",
  2: "x",
  3: "▒",
  4: "L",
  5: "c",
  6: "t",
  7: "J",
  9: "*",
  10: "E",
  11: "u",
  12: "F",
  13: "U",
  14: "w",
  15: "h",
  16: "W",
  17: "e",
  18: "E",
  19: "H",
  20: "h",
  21: "o",
  22: "O",
  33: ">",
  34: "<",
  192: "S",
  193: "1",
  194: "2",
};

function tileToChar(id: number): string {
  return TILE_CHARS[id] ?? "?";
}

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clampViewport(vp: Viewport, mapW: number, mapH: number): Viewport {
  const x = Math.max(0, Math.min(vp.x, mapW - vp.width));
  const y = Math.max(0, Math.min(vp.y, mapH - vp.height));
  return { ...vp, x, y };
}

export interface PlayerPos { x: number; y: number; angle: number; name: string; }

const DIR_CHARS = [">", "\\", "v", "/", "<", "\\", "^", "/"];

function angleToChar(angle: number): string {
  const a = ((angle / 256) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const idx = Math.round(a / (Math.PI / 4)) % 8;
  return DIR_CHARS[idx];
}

export class MapRenderer {
  private tiles: number[][];
  private front?: number[][];
  private players: PlayerPos[] = [];
  private chatLines: string[] = [];
  private vp: Viewport;
  private initialized = false;

  constructor(tiles: number[][], front?: number[][]) {
    this.tiles = tiles;
    this.front = front;
    this.vp = {
      x: 0,
      y: 0,
      width: process.stdout.columns ?? 80,
      height: (process.stdout.rows ?? 26) - 2,
    };
  }

  private write(s: string): void {
    process.stdout.write(s);
  }

  private init(): void {
    this.write("\x1b[?25l");
    this.initialized = true;
  }

  setPlayers(players: PlayerPos[]): void {
    this.players = players;
  }

  pushChat(line: string): void {
    this.chatLines.push(line);
    while (this.chatLines.length > 5) this.chatLines.shift();
  }

  render(): void {
    if (!this.initialized) this.init();

    const mapH = this.tiles.length;
    const mapW = this.tiles[0]?.length ?? 0;
    const vp = clampViewport(this.vp, mapW, mapH);

    const out: string[] = [];
    out.push("\x1b[2J\x1b[H");

    for (const line of this.chatLines) out.push(line + "\n");

    const mapHeight = this.vp.height - this.chatLines.length;

    const grid: string[][] = [];
    for (let row = vp.y; row < vp.y + mapHeight; row++) {
      const chars: string[] = [];
      for (let col = vp.x; col < vp.x + vp.width; col++) {
        const f = this.front?.[row]?.[col] ?? 0;
        chars.push(tileToChar(f !== 0 ? f : (this.tiles[row]?.[col] ?? 0)));
      }
      grid.push(chars);
    }

    for (const p of this.players) {
      const px = Math.floor(p.x / 32);
      const py = Math.floor(p.y / 32);
      const gridRow = py - vp.y;
      if (gridRow >= 0 && gridRow < grid.length && px >= vp.x && px < vp.x + vp.width) {
        grid[gridRow][px - vp.x] = angleToChar(p.angle);
      }
      const nameRow = gridRow - 1;
      if (nameRow >= 0 && nameRow < grid.length) {
        for (let i = 0; i < p.name.length; i++) {
          const col = px - vp.x + i;
          if (col >= 0 && col < this.vp.width) grid[nameRow][col] = p.name[i];
        }
      }
    }

    for (const chars of grid) out.push(chars.join("") + "\n");

    out.push(
      `\x1b[7m x:${vp.x} y:${vp.y}  map:${mapW}x${mapH}  [WASD/arrows] move  [Q] quit \x1b[0m`
    );

    this.write(out.join(""));
  }

  move(dx: number, dy: number): void {
    this.vp.x += dx;
    this.vp.y += dy;
    this.render();
  }

  destroy(): void {
    this.write("\x1b[?25h");
    this.write("\n");
  }
}

export function startInteractive(tiles: number[][], front?: number[][]): void {
  const renderer = new MapRenderer(tiles, front);
  renderer.render();

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  const STEP = 4;

  process.stdin.on("keypress", (_str, key) => {
    if (!key) return;

    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      renderer.destroy();
      process.exit(0);
    }

    const moves: Record<string, [number, number]> = {
      up:    [0, -STEP],
      down:  [0,  STEP],
      left:  [-STEP, 0],
      right: [ STEP, 0],
      w:     [0, -STEP],
      s:     [0,  STEP],
      a:     [-STEP, 0],
      d:     [ STEP, 0],
    };

    const mv = moves[key.name ?? ""];
    if (mv) renderer.move(mv[0], mv[1]);
  });

  process.on("SIGINT", () => {
    renderer.destroy();
    process.exit(0);
  });
}

export function attachCameraControls(renderer: MapRenderer): void {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  const STEP = 4;

  process.stdin.on("keypress", (_str, key) => {
    if (!key) return;

    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      renderer.destroy();
      process.exit(0);
    }

    const moves: Record<string, [number, number]> = {
      up:    [0, -STEP],
      down:  [0,  STEP],
      left:  [-STEP, 0],
      right: [ STEP, 0],
      w:     [0, -STEP],
      s:     [0,  STEP],
      a:     [-STEP, 0],
      d:     [ STEP, 0],
    };

    const mv = moves[key.name ?? ""];
    if (mv) renderer.move(mv[0], mv[1]);
  });

  process.on("SIGINT", () => {
    renderer.destroy();
    process.exit(0);
  });
}

// import { startInteractive } from "./render";
// startInteractive(yourParsedTiles);