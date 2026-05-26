# @twlibn/snapshot
(https://github.com/swarfeya/teeworlds-library-ts/ по сути почти полностью нагло украл отсюда, но переделал. типы оставил такими же)

парсер snapshot teeworlds/DDNet. [twlibn](www.npmjs.com/org/twlibn/)

0374flop MIT

## начало

установка
```
npm install @twlibn/snapshot
```

импорт
```ts
import { Snapshot } from '@twlibn/snapshot';
```
```js
const { Snapshot } = require('@twlibn/snapshot');
```

## документация

### Snapshot

```ts
const snap = new Snapshot();

const { items, recvTick } = snap.unpackSnapshot(buf, deltatick, recvTick, crc?);
// если recvTick вернулся -1 - снапшот невалиден

const { items } = snap.unpackFullSnapshot(buf, recvTick); // полный снапшот (demo / SNAPSINGLE)
```

**snap.deltas** - текущие объекты `DeltaItem[]`

**snap.events** - события последнего тика `{ type_id, parsed }[]`

**snap.crc()** - CRC текущего снапшота

**snap.crc_errors** - счётчик CRC ошибок подряд

**snap.reset()** - сбросить состояние

### DeltaItem

```ts
{
    type_id: number;
    id: number;
    key: number; // (type_id << 16) | id
    data: number[]; // сырые int
    parsed: Item | DDNetItem;
}
```

type_id: `1` PlayerInput, `2` Projectile, `3` Laser, `4` Pickup, `5` Flag, `6` GameInfo, `7` GameData, `8` CharacterCore, `9` Character, `10` PlayerInfo, `11` ClientInfo, `12` SpectatorInfo, `13-20` события, `>=0x4000` DDNet UUID объекты

### события

```ts
import { EVENT_TYPE_NAMES } from '@twlibn/snapshot';
// { 13: "common", 14: "explosion", 15: "spawn", 16: "hammerhit", 17: "death", 18: "sound_global", 19: "sound_world", 20: "damage_indicator" }

for (const event of snap.events) {
    console.log(EVENT_TYPE_NAMES[event.type_id], event.parsed);
}
```

### DDNet объекты

UUID объекты регистрируются автоматически. имеют `type_id >= 0x4000`.

поддерживаемые: `DDNetCharacter`, `DDNetPlayer`, `GameInfoEx`, `DDNetProjectile`, `DDNetLaser`
