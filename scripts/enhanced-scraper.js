const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Treatment categories mapping
const TREATMENT_CATEGORIES = {
  ansiktsbehandlinger: 'facial',
  injeksjoner: 'injectable',
  laser: 'laser',
  kropp: 'body',
  medisinsk: 'medical'
};

// Skin concerns to look for in treatment descriptions
const SKIN_CONCERNS = [
  'akne', 'aknearr', 'pigmentering', 'rynker', 'aldring', 'solskade',
  'rosacea', 'arr', 'strekkmerker', 'cellulitter', 'hårfjerning',
  'hudstramming', 'porer', 'elastisitet', 'fuktighet', 'glød'
];

async function scrapeAllTreatments() {
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 60000
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  const allTreatments = [];
  const clinicInfo = {};

  try {
    // First scrape main page for general clinic info
    console.log('📋 Scraping main page for clinic info...');
    await page.goto('https://egerskinclinic.no', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Extract contact info
    clinicInfo.contact = await page.evaluate(() => {
      const phoneRegex = /(\+47\s?)?[\d\s]{8,}/g;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const bodyText = document.body.innerText;
      
      const phones = bodyText.match(phoneRegex) || [];
      const emails = bodyText.match(emailRegex) || [];
      
      return {
        phone: phones[0] || '',
        email: emails[0] || 'post@egerskinclinic.no',
        booking_url: 'https://egerskinclinic.no/booking'
      };
    });

    // Navigate to treatments page
    console.log('🔍 Finding all treatment categories...');
    await page.goto('https://egerskinclinic.no/behandlinger', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Get all treatment category links
    const categoryLinks = await page.evaluate(() => {
      const links = [];
      // Look for category sections or menu items
      const categorySelectors = [
        'a[href*="/behandlinger/"][href*="ansiktsbehandlinger"]',
        'a[href*="/behandlinger/"][href*="injeksjoner"]',
        'a[href*="/behandlinger/"][href*="laser"]',
        'a[href*="/behandlinger/"][href*="kropp"]',
        'a[href*="/behandlinger/"][href*="medisinsk"]',
        '.treatment-category a',
        '.menu-item a[href*="/behandlinger/"]',
        'nav a[href*="/behandlinger/"]'
      ];
      
      for (const selector of categorySelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.href && !el.href.includes('#') && el.href !== 'https://egerskinclinic.no/behandlinger/') {
            links.push({
              url: el.href,
              text: el.textContent.trim()
            });
          }
        });
      }
      
      // Also get direct treatment links from the main treatments page
      const treatmentCards = document.querySelectorAll('[class*="treatment"], [class*="service"], article a');
      treatmentCards.forEach(card => {
        const link = card.href || card.querySelector('a')?.href;
        if (link && link.includes('/behandlinger/') && !link.includes('#')) {
          links.push({
            url: link,
            text: card.textContent.trim().split('\\n')[0]
          });
        }
      });
      
      return links;
    });

    // Try alternative approach - look for specific treatment URLs
    const specificTreatments = [
      'botox', 'filler', 'profhilo', 'skinbooster',
      'laser-haarfjerning', 'fotona', 'co2-laser',
      'chemical-peel', 'prp', 'microneedling',
      'hydrafacial', 'dermapen', 'sculptra'
    ];

    for (const treatment of specificTreatments) {
      categoryLinks.push({
        url: `https://egerskinclinic.no/behandlinger/${treatment}`,
        text: treatment.charAt(0).toUpperCase() + treatment.slice(1).replace('-', ' ')
      });
    }

    // Remove duplicates
    const uniqueLinks = [...new Map(categoryLinks.map(item => [item.url, item])).values()];
    
    console.log(`📊 Found ${uniqueLinks.length} potential treatment pages`);

    // Scrape each treatment page
    for (const link of uniqueLinks) {
      try {
        console.log(`💉 Scraping: ${link.text}`);
        
        const response = await page.goto(link.url, { 
          waitUntil: 'domcontentloaded',
          timeout: 20000 
        });
        
        // Skip if page doesn't exist
        if (response.status() === 404) {
          console.log(`   ⚠️ Page not found: ${link.url}`);
          continue;
        }

        await page.waitForTimeout(1000);

        const treatmentData = await page.evaluate((concerns) => {
          // Helper function to extract text
          const getText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.textContent.trim() : '';
          };
          
          const getAllText = (selector) => {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements).map(el => el.textContent.trim()).filter(t => t);
          };

          // Extract treatment details
          const title = getText('h1') || getText('.page-title') || getText('[class*="title"]');
          
          // Get all paragraphs for description
          const paragraphs = getAllText('p').filter(p => p.length > 50);
          const description = paragraphs.slice(0, 3).join(' ').substring(0, 800);
          
          // Extract price if mentioned
          const priceRegex = /(?:kr|NOK|,-)\s*[\d\s]+(?:\s*(?:kr|NOK|,-))?/gi;
          const bodyText = document.body.innerText;
          const prices = bodyText.match(priceRegex) || [];
          
          // Extract benefits/results
          const benefits = getAllText('li').filter(li => 
            li.length > 10 && 
            li.length < 150 && 
            !li.includes('cookie') &&
            !li.includes('samtykke')
          ).slice(0, 8);
          
          // Find matching skin concerns
          const fullText = (title + ' ' + description + ' ' + benefits.join(' ')).toLowerCase();
          const matchedConcerns = concerns.filter(concern => 
            fullText.includes(concern)
          );
          
          // Extract treatment time if mentioned
          const timeRegex = /(\d+)\s*(?:min|minutter|timer?)/gi;
          const timeMatches = bodyText.match(timeRegex) || [];
          
          // Look for booking CTAs
          const bookingButtons = Array.from(document.querySelectorAll('a')).filter(a => 
            a.textContent.toLowerCase().includes('book') || 
            a.textContent.toLowerCase().includes('bestill') ||
            a.href.includes('booking')
          );
          
          return {
            title: title || '',
            description: description || '',
            benefits: benefits,
            prices: prices.slice(0, 3),
            duration: timeMatches[0] || '',
            skinConcerns: matchedConcerns,
            hasBookingCTA: bookingButtons.length > 0,
            images: Array.from(document.querySelectorAll('img'))
              .filter(img => img.src && !img.src.includes('logo'))
              .slice(0, 3)
              .map(img => img.src)
          };
        }, SKIN_CONCERNS);

        // Only add if we got meaningful data
        if (treatmentData.title && treatmentData.description) {
          // Determine category
          let category = 'specialized';
          const urlLower = link.url.toLowerCase();
          for (const [key, value] of Object.entries(TREATMENT_CATEGORIES)) {
            if (urlLower.includes(key)) {
              category = value;
              break;
            }
          }
          
          // Add treatment combinations suggestions
          const combinations = suggestCombinations(treatmentData.title, treatmentData.skinConcerns);
          
          allTreatments.push({
            ...treatmentData,
            url: link.url,
            category: category,
            suggestedCombinations: combinations,
            popularity: determinePopularity(treatmentData.title)
          });
        }
      } catch (error) {
        console.log(`   ❌ Error scraping ${link.url}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Fatal scraping error:', error);
  } finally {
    await browser.close();
  }

  return { treatments: allTreatments, clinicInfo };
}

function suggestCombinations(treatmentName, skinConcerns) {
  const combinations = [];
  const nameLower = treatmentName.toLowerCase();
  
  if (nameLower.includes('botox')) {
    combinations.push('Filler', 'Profhilo', 'Chemical Peel');
  }
  if (nameLower.includes('filler')) {
    combinations.push('Botox', 'Skinbooster', 'PRP');
  }
  if (nameLower.includes('laser')) {
    combinations.push('Chemical Peel', 'Skinbooster', 'Microneedling');
  }
  if (skinConcerns.includes('akne')) {
    combinations.push('Chemical Peel', 'LED-terapi', 'Medisinsk hudpleie');
  }
  if (skinConcerns.includes('aldring') || skinConcerns.includes('rynker')) {
    combinations.push('Botox', 'Filler', 'Profhilo', 'Laser');
  }
  
  return combinations.slice(0, 3);
}

function determinePopularity(treatmentName) {
  const popular = ['botox', 'filler', 'profhilo', 'hydrafacial', 'laser'];
  const nameLower = treatmentName.toLowerCase();
  
  for (const term of popular) {
    if (nameLower.includes(term)) {
      return 'high';
    }
  }
  return 'medium';
}

async function saveData(data) {
  const dataDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  
  // Save treatments data
  await fs.writeFile(
    path.join(dataDir, 'treatments.json'),
    JSON.stringify(data.treatments, null, 2)
  );
  
  // Save clinic info
  await fs.writeFile(
    path.join(dataDir, 'clinic-info.json'),
    JSON.stringify(data.clinicInfo, null, 2)
  );
  
  // Create a simplified mapping for the chatbot
  const skinConcernMapping = {};
  data.treatments.forEach(treatment => {
    treatment.skinConcerns.forEach(concern => {
      if (!skinConcernMapping[concern]) {
        skinConcernMapping[concern] = [];
      }
      skinConcernMapping[concern].push({
        name: treatment.title,
        category: treatment.category,
        url: treatment.url
      });
    });
  });
  
  await fs.writeFile(
    path.join(dataDir, 'concern-mapping.json'),
    JSON.stringify(skinConcernMapping, null, 2)
  );
  
  console.log(`
✅ Scraping complete!
📁 Saved ${data.treatments.length} treatments to data/treatments.json
📁 Saved clinic info to data/clinic-info.json
📁 Created skin concern mappings in data/concern-mapping.json
  `);
}

async function main() {
  console.log('🚀 Starting Enhanced Eger Skin Clinic Scraper...\n');
  const data = await scrapeAllTreatments();
  await saveData(data);
}

main().catch(console.error);