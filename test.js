const fs = require('fs');
const { jsonToPDF } = require('./index.js');
const path = require('path');

const folder = './test-files-2';
async function run() {
  const files = fs.readdirSync(folder);
  for (let file of files) {
    if (file.indexOf('.json') === -1) {
      continue;
    }

    const data = fs.readFileSync(path.join(folder, file)).toString();
    const json = JSON.parse(data);

    console.log(`Processing ${folder} ${file}`);

    const pdfFileName = file.replace('.json', '.pdf');

    await jsonToPDF(json, path.join(folder, pdfFileName));
  }
}

run();
