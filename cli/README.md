# @twlibn/demo
парсер `.demo` файлов teeworlds/DDNet.
[twlibn](www.npmjs.com/org/twlibn/)

0374flop MIT

## начало
установка
```
npm install @twlibn/demo
```
импорт
```ts
import { DemoParser } from '@twlibn/demo';
```
```js
const { DemoParser } = require('@twlibn/demo');
```
простейший пример
```ts
import { DemoParser } from '@twlibn/demo';
import { readFileSync } from 'fs';

const buf = readFileSync('my_demo.demo');
const demo = DemoParser.parse(buf);

console.log(demo.header); // DemoHeader
console.log(demo.chunks); // DemoChunk[]
console.log(demo.map_data); // Buffer — данные карты
```

## документация

### DemoParser

**DemoParser.parse(buf)** - парсит буфер `.demo` файла. возвращает `ParsedDemo`.

поддерживаемые версии демо: **3, 4, 5, 6**

---

### ParsedDemo

**header** - заголовок демо. `DemoHeader`

**timeline** - маркеры таймлайна (только v4+). `TimelineMarkers | undefined`

**map_data** - сырые данные карты. `Buffer` (можно скормить в `@twlibn/map`)

**chunks** - все чанки демо. `DemoChunk[]`

### DemoChunk

два типа чанков — `TickChunk` и `DataChunk`.

```ts
import { ChunkType } from '@twlibn/demo';

for (const chunk of demo.chunks) {
    if (chunk.kind === 'tick') {
        console.log(chunk.tick, chunk.keyframe);
    }
    if (chunk.kind === 'chunk') {
        if (chunk.type === ChunkType.Snapshot) { /* */ }
        if (chunk.type === ChunkType.Message)  { /* */ }
    }
}
```

#### TickChunk

**tick** - номер тика

**keyframe** - является ли кейфреймом

**delta** - тик закодирован как дельта от предыдущего

#### DataChunk

**type** - `ChunkType.Invalid | Snapshot | Message | SnapshotDelta`

**data** - сырые данные чанка. `Buffer`

---

### пример вместе с @twlibn/map

```ts
import { DemoParser } from '@twlibn/demo';
import { MapParser } from '@twlibn/map';
import { readFileSync } from 'fs';

const demo = DemoParser.parse(readFileSync('my_demo.dem'));
const map = MapParser.parse(demo.map_data);

console.log(map.game_layer);
```