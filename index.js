const PDFDocument = require('pdfkit');
const fs = require('fs');
const fetch = require('node-fetch');
const parseColor = require('parse-color');
const getUrls = require('get-urls');
const Canvas = require('canvas');
const svg = require('./svg.js');
const SVGtoPDF = require('svg-to-pdfkit');
PDFDocument.prototype.addSVG = function (svg, x, y, options) {
  return SVGtoPDF(this, svg, x, y, options), this;
};
const xmldom = require('xmldom');

global.DOMParser = xmldom.DOMParser;
global.XMLSerializer = xmldom.XMLSerializer;

global.fetch = (url) => {
  if (url.indexOf('base64') >= 0) {
    return {
      text: async () => {
        let buff = Buffer.from(url.split('base64,')[1], 'base64');
        return buff.toString('ascii');
      },
    };
  }
  return fetch(url);
};

const DPI = 75;
function pxToPt(px) {
  return (px * DPI) / 100;
}

async function getGoogleFontPath(fontFamily) {
  const url = `https://fonts.googleapis.com/css?family=${fontFamily}`;
  const req = await fetch(url);
  const text = await req.text();
  const urls = getUrls(text);
  return urls.values().next().value;
}

const PIXEL_RATIO = 2;

async function cropImage(src, element) {
  const image = await Canvas.loadImage(src);
  const canvas = new Canvas.Canvas();

  canvas.width = element.width * PIXEL_RATIO;
  canvas.height = element.height * PIXEL_RATIO;

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

async function srcToBase64(src) {
  if (src.indexOf('base64') >= 0) {
    return src.split('base64,')[1];
  }
  const res = await fetch(src);
  const data = await res.buffer();
  return data.toString('base64');
}

async function srcToBuffer(src) {
  return Buffer.from(await srcToBase64(src), 'base64');
}

module.exports.jsonToPDF = async function jsonToPDF(json, pdfFileName) {
  const fonts = {};

  var doc = new PDFDocument({
    size: [json.width, json.height],
    autoFirstPage: false,
  });

  // Stream contents to a file
  doc.pipe(fs.createWriteStream(pdfFileName)).on('finish', function () {});

  for (const font of json.fonts) {
    // Register a font
    doc.registerFont(font.fontFamily, await srcToBuffer(font.url));
    fonts[font.fontFamily] = true;
  }

  for (const page of json.pages) {
    doc.addPage();
    if (page.background) {
      const isURL =
        page.background.indexOf('http') >= 0 ||
        page.background.indexOf('.png') >= 0 ||
        page.background.indexOf('.jpg') >= 0;

      if (isURL) {
        doc.image(await srcToBuffer(page.background), 0, 0);
      } else {
        doc.rect(0, 0, json.width, json.height);
        doc.fill(parseColor(page.background).hex);
      }
    }
    for (const child of page.children) {
      doc.save();
      doc.translate(child.x, child.y);
      doc.rotate(child.rotation);
      if (child.type === 'text') {
        // doc.setFontSize(child.fontSize);
        // // doc.setFontType(child.fontStyle + child.fontWeight);
        // // doc.setFont(child.fontFamily);
        // doc.setDrawColor(...rgb);
        // doc.rect(child.x, child.y, child.width, child.height);

        // doc.setTextColor(...rgb);
        if (!fonts[child.fontFamily]) {
          const src = await getGoogleFontPath(child.fontFamily);
          doc.registerFont(child.fontFamily, await srcToBuffer(src));
          fonts[child.fontFamily] = true;
        }
        doc.font(child.fontFamily);

        doc.fontSize(child.fontSize);
        // console.log(child.fill);
        doc.fillColor(parseColor(child.fill).hex);
        doc.text(child.text, 0, 0, {
          align: child.align,
          fill: child.fill,
          baseline: 'top',
          lineGap: (child.lineHeight - 1) * child.fontSize,
          width: child.width + 2,
          underline: child.textDecoration.indexOf('underline') >= 0,
        });
      }
      if (child.type === 'line') {
        doc.lineWidth(child.height);
        doc.moveTo(0, 0);
        doc.lineTo(child.width, 0);
        doc.stroke();
      }
      if (child.type === 'image') {
        let src = await cropImage(child.src, child);
        if (src) {
          doc.image(await srcToBuffer(src), 0, 0, {
            width: child.width,
            height: child.height,
          });
        }
      }
      if (child.type === 'svg') {
        const svgStr = await svg.urlToString(child.src);
        src = svg.replaceColors(
          svgStr,
          new Map(Object.entries(child.colorsReplace))
        );
        const str = await svg.urlToString(src);
        doc.addSVG(str, 0, 0, {
          preserveAspectRatio: 'xMinYMin meet',
          width: child.width,
          height: child.height,
        });
      }
      doc.restore();
    }
  }

  // Close PDF and write file.
  doc.end();
};
