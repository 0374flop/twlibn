# @twlibn/map
парсер `.map` файлов teeworlds/DDNet.
[twlibn](www.npmjs.com/org/twlibn/)

0374flop MIT

## начало

установка
```
npm install @twlibn/map
```

импорт
```ts
import { MapParser } from '@twlibn/map';
```

```js
const { MapParser } = require('@twlibn/map');
```

простейший пример
```ts
import { MapParser } from '@twlibn/map';
import { readFileSync } from 'fs';

const buf = readFileSync('my_map.map');
const map = MapParser.parse(buf);

console.log(map.game_layer); // TileLayer
console.log(map.groups);     // LayerGroup[]
console.log(map.images);     // MapImage[]
```

## документация

### MapParser

**MapParser.parse(buf)** - парсит буфер `.map` файла. возвращает `MapInfo`.

**MapParser.get_tile(map, x, y)** - возвращает тайл игрового слоя по координатам. `Tile | undefined`

#### проверки тайлов

**MapParser.is_solid(tile)** - SOLID

**MapParser.is_freeze(tile)** - FREEZE

**MapParser.is_dfreeze(tile)** - DEEP FREEZE

**MapParser.is_nohook(tile)** - NOHOOK

**MapParser.is_hookthrough(tile)** - THROUGH / THROUGH_CUT

**MapParser.is_death(tile)** - DEATH

**MapParser.is_air(tile)** - AIR (или undefined)

**MapParser.tile_name(id)** - имя тайла. `"freeze"`, `"solid"` ...
### type guards
```ts
import { is_tile_layer, is_quad_layer } from '@twlibn/map';

for (const layer of group.layers) {
    if (is_tile_layer(layer)) { /* TileLayer */ }
    if (is_quad_layer(layer)) { /* QuadLayer */ }
}
```
### примеры
#### найти все freeze тайлы
```ts
const layer = map.game_layer;

for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
        const tile = layer.tiles[y][x];
        if (MapParser.is_freeze(tile)) {
            console.log(`freeze at ${x},${y}`);
        }
    }
}
```
#### телепорты
```ts
const tele = map.tele_layer;

for (let y = 0; y < tele.height; y++) {
    for (let x = 0; x < tele.width; x++) {
        const t = tele.tele_tiles[y][x];
        if (t.id !== 0) console.log(`tele #${t.number} at ${x},${y}`);
    }
}
```