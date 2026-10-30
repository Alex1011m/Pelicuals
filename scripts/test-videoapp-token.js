const https = require('https');

function fetch(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://pelispedia.nl/' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const d = await fetch('https://videoapp.mov/e/movie/1153576');
  const tokenMatch = d.match(/cfToken\s*=\s*"([^"]+)"/);
  if (tokenMatch) {
    const parts = tokenMatch[1].split('.');
    if (parts[1]) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      console.log('JWT Payload:', JSON.stringify(payload, null, 2));
    }
  }

  // Also check vimeos.net embed URL
  const cheerio = require('cheerio');
  const $ = cheerio.load(d);
  const iframe = $('iframe').attr('src');
  console.log('Iframe:', iframe);
  if (iframe) {
    const vimeosHtml = await fetch(iframe);
    console.log('Vimeos html length:', vimeosHtml.length);
    // Search for resolution or quality flags
    const m = vimeosHtml.match(/(resolution|quality|calidad|cam|1080|720|480|360|ts)/gi);
    console.log('Vimeos matches:', m ? m.slice(0, 10) : 'none');
  }
}

run();

