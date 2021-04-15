import fs from 'fs';
import { jsonToPDF } from './index.js';

async function run() {
  const json = JSON.parse(fs.readFileSync('./polotno.json'));
  await jsonToPDF(json, './out.pdf');
}

run();
