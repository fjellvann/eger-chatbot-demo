const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function scrapeTreatments() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const treatments = {
    facial: [],
    advanced: [],
    laser: [],
    injectable: [],
    specialized: []
  };

  const treatmentDetails = [];

  try {
    console.log('Scraping main page...');
    await page.goto('https://egerskinclinic.no', { waitUntil: 'networkidle' });
    
    const mainContent = await page.evaluate(() => {
      const getText = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => el.textContent.trim()).filter(t => t);
      };

      return {
        headlines: getText('h1, h2, h3'),
        paragraphs: getText('p'),
        lists: getText('li')
      };
    });

    console.log('Scraping treatments page...');
    await page.goto('https://egerskinclinic.no/behandlinger', { waitUntil: 'networkidle' });
    
    const treatmentLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/behandlinger/"]');
      return Array.from(links).map(link => ({
        url: link.href,
        text: link.textContent.trim()
      })).filter(l => l.text && !l.url.includes('#'));
    });

    const uniqueLinks = [...new Map(treatmentLinks.map(item => [item.url, item])).values()];
    
    console.log(`Found ${uniqueLinks.length} treatment pages to scrape...`);

    for (const link of uniqueLinks.slice(0, 20)) {
      try {
        console.log(`Scraping: ${link.text}`);
        await page.goto(link.url, { waitUntil: 'networkidle', timeout: 30000 });
        
        const treatment = await page.evaluate(() => {
          const title = document.querySelector('h1')?.textContent?.trim() || '';
          const description = Array.from(document.querySelectorAll('p'))
            .map(p => p.textContent.trim())
            .filter(t => t && t.length > 20)
            .slice(0, 5)
            .join(' ');
          
          const benefits = Array.from(document.querySelectorAll('li'))
            .map(li => li.textContent.trim())
            .filter(t => t && t.length > 5 && t.length < 100);
          
          return {
            title,
            description: description.substring(0, 500),
            benefits: benefits.slice(0, 5)
          };
        });

        if (treatment.title) {
          treatmentDetails.push({
            ...treatment,
            url: link.url,
            category: categorizetreatment(treatment.title)
          });
        }
      } catch (error) {
        console.log(`Error scraping ${link.url}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    await browser.close();
  }

  return treatmentDetails;
}

function categorizetreatment(title) {
  const lower = title.toLowerCase();
  if (lower.includes('laser') || lower.includes('fotona')) return 'laser';
  if (lower.includes('filler') || lower.includes('botox') || lower.includes('restylane')) return 'injectable';
  if (lower.includes('facial') || lower.includes('hydra')) return 'facial';
  if (lower.includes('dermapen') || lower.includes('plasma') || lower.includes('prf')) return 'advanced';
  return 'specialized';
}

async function saveData(data) {
  const dataDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  
  await fs.writeFile(
    path.join(dataDir, 'treatments.json'),
    JSON.stringify(data, null, 2)
  );
  
  console.log(`Saved ${data.length} treatments to data/treatments.json`);
}

async function main() {
  console.log('Starting Eger Skin Clinic scraper...');
  const treatments = await scrapeTreatments();
  await saveData(treatments);
  console.log('Scraping complete!');
}

main().catch(console.error);