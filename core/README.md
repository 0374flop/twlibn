# @twlibn/core
низкоуровневые примитивы teeworlds/DDNet протокола. основа для остальных пакетов [twlibn](www.npmjs.com/org/twlibn/).

0374flop MIT

## начало

установка
```
npm install @twlibn/core
```

импорт
```ts
import { Huffman, States, createTwMD5Hash, UUIDManager, BufReader, BufWriter, intsToStr, strToInts, VarIntReader, packInt, packInts, varintToLE, MsgPacker, MsgUnpacker } from '@twlibn/core';
```
```js
const { Huffman, States, createTwMD5Hash, UUIDManager, BufReader, BufWriter, intsToStr, strToInts, VarIntReader, packInt, packInts, varintToLE, MsgPacker, MsgUnpacker } = require('@twlibn/core');
```

## документация

### Huffman

DDNet huffman (https://github.com/swarfeya/teeworlds-library-ts/ нагло украл отсюда)

```ts
import { Huffman } from '@twlibn/core';

const huff = new Huffman();

const compressed = huff.compress(Buffer.from([1, 2, 3]));
const decompressed = huff.decompress(compressed);
```

**new Huffman(frequencies?)** - по умолчанию используется таблица DDNet.

**huff.compress(buf, start?, size?): Buffer**

**huff.decompress(buf, size?): Buffer**

### Msg 
(https://github.com/swarfeya/teeworlds-library-ts/ нагло украл отсюда)
#### MsgPacker
```ts
import { MsgPacker, NETMSG } from '@twlibn/core';

const packer = new MsgPacker(NETMSG.System.NETMSG_INFO, true, 0);
packer.AddString('0.7 802f1be60a05665f');
packer.AddString('');
packer.AddInt(0);

const buf = packer.buffer; // Buffer
```

**new MsgPacker(msg, sys, flag)** - создать паккер, `msg` - id сообщения, `sys` - системное или игровое

**packer.AddString(str)** - добавить null-terminated строку

**packer.AddInt(i)** - добавить varint

**packer.AddBuffer(buf)** - добавить сырые байты

**packer.buffer** - итоговый буфер `Buffer`

**packer.size** - размер в байтах

#### MsgUnpacker
```ts
import { MsgUnpacker } from '@twlibn/core';

const unpacker = new MsgUnpacker(buf);
const version = unpacker.unpackString();
const password = unpacker.unpackString();
const reserved = unpacker.unpackInt();
```

**new MsgUnpacker(buf)** - создать унпаккер из буфера

**unpacker.unpackInt()** - прочитать varint `number`

**unpacker.unpackString()** - прочитать null-terminated строку `string`

**unpacker.unpackRaw(size)** - прочитать `size` байт `Buffer`

**unpacker.remaining** - сколько байт осталось

### VarIntReader / packInt

DDNet varint кодирование

```ts
import { VarIntReader, packInt, packInts, varintToLE } from '@twlibn/core';

const reader = new VarIntReader(buf);
const value = reader.readInt();
const values = reader.readInts(5);

const encoded = packInt(-42);
const encodedMany = packInts([1, 2, 3]);

const asLE = varintToLE(buf); // конвертировать varint-буфер в little-endian int32
```

### BufReader / BufWriter

удобное чтение/запись бинарных данных

```ts
import { BufReader, BufWriter } from '@twlibn/core';

const r = new BufReader(buf);
const a = r.u8();
const b = r.i32be();
const s = r.cstring(64);

const w = new BufWriter();
w.u8(1).i32be(1234).cstring('hello', 64);
const result = w.build();
```

методы `BufReader`: `u8`, `u16le`, `i32be`, `i32le`, `raw(size)`, `cstring(size)`, `remaining`

методы `BufWriter`: `u8`, `u16le`, `i32be`, `i32le`, `raw(buf)`, `cstring(str, size)`, `build()`, `size`

### intsToStr / strToInts

конвертация строк в ddnet packed int формат

```ts
import { intsToStr, strToInts } from '@twlibn/core';

const name = intsToStr([...clientInfo.name]); // int[] → string
const ints = strToInts('nameless tee', 4);    // string → int[] (4 слота = 15 байт)
```

### NETMSG
enum всех системных и игровых сообщений ddnet протокола (включая UUID-расширения). 
(https://github.com/swarfeya/teeworlds-library-ts/ нагло украл отсюда)
```ts
import { NETMSG } from '@twlibn/core';

NETMSG.System.NETMSG_INFO       // 1
NETMSG.System.NETMSG_SNAP       // 5
NETMSG.Game.SV_CHAT             // 3
NETMSG.UUID.SV_DDRACETIME       // ...
```

### SnapshotItemIDs
(https://github.com/swarfeya/teeworlds-library-ts/ нагло украл отсюда)
```ts
import { SnapshotItemIDs } from '@twlibn/core';

SnapshotItemIDs.OBJ_CHARACTER   // 9
SnapshotItemIDs.OBJ_CLIENT_INFO // 11
```

### UUIDManager / createTwMD5Hash

менеджер UUID расширений DDNet протокола. (https://github.com/swarfeya/teeworlds-library-ts/ нагло украл отсюда)

```ts
import { UUIDManager, createTwMD5Hash } from '@twlibn/core';

const manager = new UUIDManager(65536);
manager.RegisterName('ddnet-16@ddnet.tw');

const entry = manager.LookupName('ddnet-16@ddnet.tw');
// { name, hash: Buffer, type_id }

const hash = createTwMD5Hash('some-uuid-name@ddnet.tw'); // Buffer (16 байт)
```

**new UUIDManager(offset?, snapshot?)** - создать менеджер. `snapshot` меняет направление счётчика type_id

**manager.RegisterName(name, type_id?)** - зарегистрировать UUID по имени

**manager.LookupUUID(hash)** - найти по хешу

**manager.LookupName(name)** - найти по имени

**manager.LookupType(id)** - найти по type_id