import PDFDocument from 'pdfkit';
import fs from 'fs';
import fetch from 'node-fetch';
import parseColor from 'parse-color';
import getUrls from 'get-urls';
import Canvas from 'canvas';

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

async function cropImage(element) {
  // if (element.src.length >= 300) {
  //   return '';
  // }
  const image = await Canvas.loadImage(element.src);
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

  return canvas.toDataURL();
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

export async function jsonToPDF(json, pdfFileName) {
  const fonts = {};

  var doc = new PDFDocument({
    size: [json.width, json.height],
  });

  // Stream contents to a file
  doc.pipe(fs.createWriteStream(pdfFileName)).on('finish', function () {});

  for (const font of json.fonts) {
    // Register a font
    doc.registerFont(font.fontFamily, await srcToBuffer(font.url));
    fonts[font.fontFamily] = true;
  }

  for (const page of json.pages) {
    if (page.background) {
      doc.image(await srcToBuffer(page.background), 0, 0);
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
          // baseline: 'top',
          // angle: child.rotation,
          width: child.width,
          underline: child.textDecoration.indexOf('underline') >= 0,
        });
      }
      if (child.type === 'image' || child.type === 'svg') {
        const cropped = await cropImage(child);
        if (cropped) {
          doc.image(await srcToBuffer(cropped), 0, 0, {
            width: child.width,
            height: child.height,
          });
        }
      }
      doc.restore();
    }
  }

  // Close PDF and write file.
  doc.end();
}
