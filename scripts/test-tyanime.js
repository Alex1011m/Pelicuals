const https = require('https');

function fetch(url) {
  return new Promise(r => https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    if (res.headers.location) return fetch(res.headers.location).then(r);
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(d));
  }));
}

function unpack(code) {
  var match = code.match(/}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
  if (!match) return null;
  var p = match[1];
  var a = parseInt(match[2], 10);
  var c = parseInt(match[3], 10);
  var kArr = match[4].split('|');

  while (c--) {
    if (kArr[c]) {
      var reg = new RegExp('\\b' + c.toString(a) + '\\b', 'g');
      p = p.replace(reg, kArr[c]);
    }
  }
  return p;
}

fetch('https://uqload.cx/embed-4a0brmtekafb.html').then(html => {
  const unp = unpack(html);
  if (unp) {
    console.log('Unpacked Uqload snippet:');
    console.log(unp.slice(0, 300));
    const m = unp.match(/sources:\s*\[\s*["']([^"']+\.mp4[^"']*)["']/i) ||
      unp.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>?]*)/i);
    console.log('Unpacked direct MP4:', m ? (m[1] || m[0]) : 'not found');
  } else {
    console.log('Unpack failed');
  }
});
