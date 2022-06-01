var pdfcrowd = require('pdfcrowd');
var Canvas = require('canvas');
const puppeteer = require('puppeteer');

var xmldom = require('xmldom');
global.DOMParser = xmldom.DOMParser;
global.XMLSerializer = xmldom.XMLSerializer;

var svg = require('./svg');
var api = new pdfcrowd.HtmlToPdfClient(
  'lavrton',
  '7054a878b677878e79465d96c84dd7ee'
);

async function cropImage(src, element) {
  const image = await Canvas.loadImage(src);
  const canvas = new Canvas.Canvas();

  canvas.width = element.width;
  canvas.height = element.height;

  const ctx = canvas.getContext('2d');

  let { cropX, cropY } = element;

  const availableWidth = image.width * element.cropWidth;
  const availableHeight = image.height * element.cropHeight;

  const aspectRatio = element.width / element.height;

  let cropAbsoluteWidth;
  let cropAbsoluteHeight;

  const imageRatio = availableWidth / availableHeight;
  const allowScale = element.type === 'svg';

  if (allowScale) {
    cropAbsoluteWidth = availableWidth;
    cropAbsoluteHeight = availableHeight;
  } else if (aspectRatio >= imageRatio) {
    cropAbsoluteWidth = availableWidth;
    cropAbsoluteHeight = availableWidth / aspectRatio;
  } else {
    cropAbsoluteWidth = availableHeight * aspectRatio;
    cropAbsoluteHeight = availableHeight;
  }
  ctx.drawImage(
    image,
    cropX * image.width,
    cropY * image.height,
    cropAbsoluteWidth,
    cropAbsoluteHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL('image/png');
}

const fs = require('fs');

const file = './test-files-2/polotno.json';

async function getChildHTML(element) {
  let childContent = '';
  if (element.type === 'text') {
    childContent = `<div style="width: ${element.width || 100}px; color: ${
      element.fill
    } !important; font-size: ${element.fontSize}px; font-family: '${
      element.fontFamily
    }'; text-decoration: ${element.textDecoration}; text-align: ${
      element.align
    }; line-height: ${element.lineHeight}; letter-spacing: ${
      element.letterSpacing
    }; font-style: ${element.fontStyle}; font-weight: ${
      element.fontWeight
    }; -webkit-text-stroke: ${element.strokeWidth}px ${
      element.stroke
    }" contentEditable>${element.text.split('\n').join('<br/>')}</div>`;
  }
  if (element.type === 'image') {
    childContent =
      '<img src="' +
      (await cropImage(element.src, element)) +
      '" style="width: 100%; height: 100%;"/>';
  }
  if (element.type === 'svg') {
    const svgStr = await svg.urlToString(element.src);
    src = svg.replaceColors(
      svgStr,
      new Map(Object.entries(element.colorsReplace))
    );
    childContent =
      '<img src="' + src + '" style="width: 100%; height: 100%;"/>';
  }
  return `<div style="position: absolute; top: ${element.y}px; left: ${element.x}px; width: ${element.width}px; height: ${element.height}px; border-radius: ${element.cornerRadius}px; overflow: hidden;">${childContent}</div>`;
}

async function getPageHTML(page, store) {
  const children = await Promise.all(
    page.children.map((child) => getChildHTML(child))
  );
  const pageContent = children.join('');
  return `<div class="page" style="position: relative; width: ${store.width}px; height: ${store.height}px; margin: 5px; border: 1px solid grey;  overflow: hidden; background: ${page.background};">${pageContent}</div>`;
}

async function run() {
  // load sample json
  const json = JSON.parse(fs.readFileSync(file));

  console.time('export');

  const pages = await Promise.all(
    json.pages.map((page) => getPageHTML(page, json))
  );
  const documentContent = pages.join('');

  const allFonts = [];
  json.pages.forEach((page) => {
    page.children.forEach((element) => {
      if (
        element.type === 'text' &&
        allFonts.indexOf(element.fontFamily) === -1
      ) {
        allFonts.push(element.fontFamily);
      }
    });
  });

  const html = `
<html>
  <head>
    <title>Canvas editor</title>
    <style>
      body {
        padding: 0;
        margin: 0;
      }
      @media print {
        .page { page-break-before: always; } /* page-break-after works, as well */
        * {
          print-color-adjust: exact;
        }
      }
    </style>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${allFonts
      .map(
        (font) =>
          `<link href="https://fonts.googleapis.com/css?family=${font}" rel="stylesheet" />`
      )
      .join('')}
  </head>
  <body>
    ${documentContent}
  </body>
</html>
`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // set your html as the pages content
  await page.setContent(html, {
    waitUntil: 'networkidle0',
  });
  await page.pdf({
    path: `${__dirname}/document.pdf`,
    printBackground: true,
  });

  await browser.close();
  console.timeEnd('export');

  // fs.writeFileSync('./experiment.html', html, 'utf8');
  // console.log('done');
  // api.convertFileToFile(
  //   './experiment.html',
  //   'document.pdf',
  //   function (err, fileName) {
  //     console.log('Done', err, fileName);
  //     /* done */
  //   }
  // );
}
run();
