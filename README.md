# Polotno PDF

Convert polotno JSON into PDF file from NodeJS.

```bash
npm install polotno-pdf
```

```js
import fs from 'fs';
import { jsonToPDF } from 'polotno-pdf';

async function run() {
  const json = JSON.parse(fs.readFileSync('./polotno.json'));
  await jsonToPDF(json, './output.pdf');
}

run();
```
