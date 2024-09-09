const Konva = require('konva');
var fetch = require('node-fetch');

function isInsideDef(element) {
  while (element.parentNode) {
    if (element.nodeName === 'defs') {
      return true;
    }
    element = element.parentNode;
  }
  return false;
}

function getElementColors(e) {
  const colors = {
    fill: '',
    stroke: '',
  };
  if (e.getAttribute('fill') && e.getAttribute('fill') !== 'none') {
    colors.fill = e.getAttribute('fill');
  }
  if (!colors.fill && e.style && e.style.fill && e.style.fill !== 'none') {
    colors.fill = e.style.fill;
  }
  if (e.getAttribute('stroke')) {
    colors.stroke = e.getAttribute('stroke');
  }
  if (!colors.stroke && e.style && e.style.stroke) {
    colors.stroke = e.style.stroke;
  }
  if (!colors.stroke && !colors.fill) {
    colors.fill = 'black';
  }
  return colors;
}

const SVG_SHAPES = ['path', 'rect', 'circle'];

function getAllElementsWithColor(doc) {
  var matchingElements = [];
  var allElements = doc.getElementsByTagName('*');
  for (var i = 0, n = allElements.length; i < n; i++) {
    const element = allElements[i];
    if (isInsideDef(element)) {
      continue;
    }
    if (element.getAttribute('fill') !== null) {
      matchingElements.push(element);
    }
    if (element.getAttribute('stroke') !== null) {
      matchingElements.push(element);
    } else if (element.style && element.style['fill']) {
      matchingElements.push(element);
    } else if (SVG_SHAPES.indexOf(element.nodeName) >= 0) {
      matchingElements.push(element);
    }
  }
  return matchingElements;
}

module.exports.urlToBase64 = async function urlToBase64(url) {
  const req = await fetch(url);
  const svgString = await req.text();
  return svgToURL(svgString);
};

module.exports.urlToString = async function urlToString(url) {
  if (url.startsWith('data:')) {
    // console.log(Buffer.from(url.split('base64,')[1], 'base64').toString());
    return Buffer.from(url.split('base64,')[1], 'base64').toString();
  }
  const req = await fetch(url, { mode: 'cors' });
  const svgString = await req.text();
  return svgString;
};

module.exports.getColors = function getColors(svgString) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(svgString, 'text/xml');

  const elements = getAllElementsWithColor(doc);

  const colors = [];

  elements.forEach((e) => {
    const { fill, stroke } = getElementColors(e);
    const results = [fill, stroke];
    results.forEach((color) => {
      if (!color) {
        return;
      }
      const rgba = Konva.Util.colorToRGBA(color);
      if (!rgba) {
        return;
      }
      if (colors.indexOf(color) === -1) {
        colors.push(color);
      }
    });
  });
  return colors;
};

module.exports.svgToURL = function svgToURL(s) {
  const uri = Buffer.from(unescape(encodeURIComponent(s))).toString('base64');
  return 'data:image/svg+xml;base64,' + uri;
};

module.exports.getSvgSize = async function getSvgSize(url) {
  const svgString = await urlToString(url);
  var parser = new DOMParser();
  var doc = parser.parseFromString(svgString, 'image/svg+xml');
  const viewBox = doc.documentElement.getAttribute('viewBox');
  const [x, y, width, height] = viewBox?.split(' ') || [];
  return { width: parseFloat(width), height: parseFloat(height) };
};

module.exports.fixSize = function fixSize(svgString) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(svgString, 'image/svg+xml');
  const viewBox = doc.documentElement.getAttribute('viewBox');
  const [x, y, width, height] = viewBox?.split(' ') || [];
  if (!doc.documentElement.getAttribute('width')) {
    doc.documentElement.setAttribute('width', width + 'px');
  }

  if (!doc.documentElement.getAttribute('height')) {
    doc.documentElement.setAttribute('height', height + 'px');
  }
  var xmlSerializer = new XMLSerializer();
  const str = xmlSerializer.serializeToString(doc);
  return str;
};

const sameColors = (c1, c2) => {
  if (!c2 || !c2) {
    return false;
  }
  return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
};

module.exports.replaceColors = function replaceColors(svgString, replaceMap) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(svgString, 'text/xml');

  const elements = getAllElementsWithColor(doc);

  const oldColors = Array.from(replaceMap.keys());

  elements.forEach((el) => {
    const { fill, stroke } = getElementColors(el);
    const colors = [
      { prop: 'fill', color: fill },
      { prop: 'stroke', color: stroke },
    ];
    colors.forEach(({ prop, color }) => {
      // find matched oldColor
      const marchedOldValue = oldColors.find((oldColor) => {
        return sameColors(
          Konva.Util.colorToRGBA(oldColor),
          Konva.Util.colorToRGBA(color)
        );
      });
      if (!marchedOldValue) {
        return;
      } else {
        el.setAttribute(prop, replaceMap.get(marchedOldValue));

        // el[prop] = replaceMap.get(marchedOldValue);
      }
    });
  });
  var xmlSerializer = new XMLSerializer();
  const str = xmlSerializer.serializeToString(doc);

  // console.log(str);
  // Array.from(replaceMap.keys()).forEach((oldColor) => {
  //   svgString = svgString.replace(
  //     new RegExp(oldColor, 'g'),
  //     replaceMap.get(oldColor) as string
  //   );
  // });
  return module.exports.svgToURL(str);
};
