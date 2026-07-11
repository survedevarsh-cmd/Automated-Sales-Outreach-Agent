const cheerio = require('cheerio');

async function getLinkedIn(prospect, company) {
  try {
    const query = encodeURIComponent(`site:linkedin.com/in/ "${prospect}" "${company}"`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const results = [];
    $('.result__body').each((i, el) => {
      if (i >= 2) return;
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (title && snippet) results.push({ title, snippet });
    });
    
    console.log("LINKEDIN SEARCH:", results);
  } catch(e) {
    console.error(e);
  }
}
getLinkedIn('Guillermo Rauch', 'Vercel');
