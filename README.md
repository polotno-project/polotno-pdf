# Polotno to Vector PDF

Convert polotno JSON into vector PDF file from NodeJS.

```bash
npm install @polotno/to-vector-pdf
```

```js
import fs from 'fs';
import { jsonToPDF } from '@polotno/to-vector-pdf';

async function run() {
  const json = JSON.parse(fs.readFileSync('./polotno.json'));
  await jsonToPDF(json, './output.pdf');
}

run();
```
