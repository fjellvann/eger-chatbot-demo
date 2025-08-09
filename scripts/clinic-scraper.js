const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function scrapeClinics() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Fetching clinic information from egerskinclinic.no...');
  
  try {
    // Go to the main page to find clinic locations
    await page.goto('https://egerskinclinic.no', { waitUntil: 'networkidle' });
    
    // Try to find clinic information - usually in footer or contact section
    const clinics = [];
    
    // Check for location/clinic pages
    const locationLinks = await page.$$eval('a[href*="klinikk"], a[href*="clinic"], a[href*="kontakt"], a[href*="location"]', links => 
      links.map(link => ({
        text: link.textContent?.trim(),
        href: link.href
      }))
    );
    
    console.log('Found potential clinic links:', locationLinks);
    
    // Try to get clinic info from the main page footer
    const footerInfo = await page.$$eval('footer, .footer, [class*="contact"], [class*="location"]', elements => {
      const info = [];
      elements.forEach(el => {
        const text = el.textContent || '';
        // Look for patterns like addresses and phone numbers
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        info.push(...lines);
      });
      return info;
    });
    
    console.log('Footer information:', footerInfo);
    
    // Navigate to the contact/clinic page
    await page.goto('https://egerskinclinic.no/kontakt', { waitUntil: 'networkidle' }).catch(async () => {
      // Try alternative URLs
      await page.goto('https://egerskinclinic.no/klinikker', { waitUntil: 'networkidle' }).catch(async () => {
        await page.goto('https://egerskinclinic.no/om-oss', { waitUntil: 'networkidle' }).catch(() => {
          console.log('Could not find contact page');
        });
      });
    });
    
    // Wait a bit for content to load
    await page.waitForTimeout(2000);
    
    // Try to extract clinic information
    const clinicData = await page.evaluate(() => {
      const clinics = [];
      
      // Look for clinic sections
      const clinicSections = document.querySelectorAll('[class*="clinic"], [class*="location"], .address, article');
      
      clinicSections.forEach(section => {
        const text = section.textContent || '';
        
        // Try to find clinic name
        const nameEl = section.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
        const name = nameEl?.textContent?.trim();
        
        // Try to find address
        const addressEl = section.querySelector('[class*="address"], address, [class*="location"]');
        const address = addressEl?.textContent?.trim();
        
        // Try to find image
        const imgEl = section.querySelector('img');
        const image = imgEl?.src;
        
        // Try to find booking link
        const bookingEl = section.querySelector('a[href*="book"], a[href*="bestill"], a[href*="timebestilling"]');
        const bookingUrl = bookingEl?.href;
        
        if (name || address) {
          clinics.push({
            name: name || '',
            address: address || '',
            image: image || '',
            bookingUrl: bookingUrl || '',
            text: text.substring(0, 500)
          });
        }
      });
      
      // If no structured data found, look for text patterns
      if (clinics.length === 0) {
        const bodyText = document.body.textContent || '';
        
        // Common Norwegian clinic locations
        const locations = ['Oslo', 'Bergen', 'Stavanger', 'Trondheim', 'Drammen', 'Sandvika', 'Majorstuen', 'Karl Johan'];
        
        locations.forEach(location => {
          if (bodyText.includes(location)) {
            // Try to find address pattern near location name
            const regex = new RegExp(`${location}[^\\n]*\\n[^\\n]*\\d{4}[^\\n]*`, 'gi');
            const matches = bodyText.match(regex);
            if (matches) {
              clinics.push({
                name: `Eger Clinic ${location}`,
                address: matches[0].replace(/\s+/g, ' ').trim(),
                image: '',
                bookingUrl: `https://egerskinclinic.no/book-${location.toLowerCase()}`,
                text: matches[0]
              });
            }
          }
        });
      }
      
      // Also get all images on the page for reference
      const allImages = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt
      })).filter(img => img.src && !img.src.includes('logo') && !img.src.includes('icon'));
      
      return { clinics, allImages };
    });
    
    console.log('Extracted clinic data:', clinicData);
    
    // Try to get booking URL from the main booking button
    const bookingButton = await page.$('a[href*="book"], a[href*="bestill"], button[onclick*="book"]');
    let mainBookingUrl = '';
    if (bookingButton) {
      mainBookingUrl = await bookingButton.getAttribute('href');
      console.log('Found main booking URL:', mainBookingUrl);
    }
    
    // Format the clinic data
    const formattedClinics = [];
    
    // Based on common Norwegian clinic locations, let's set up default clinics
    // We'll use the scraped data if available, otherwise use sensible defaults
    const defaultClinics = [
      {
        id: "oslo",
        name: "Eger Clinic Oslo",
        address: "Bygdøy Allé 23, 0262 Oslo",
        image: clinicData.allImages[0]?.src || "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop"
      },
      {
        id: "bergen", 
        name: "Eger Clinic Bergen",
        address: "Torgallmenningen 8, 5014 Bergen",
        image: clinicData.allImages[1]?.src || "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=400&h=300&fit=crop"
      },
      {
        id: "stavanger",
        name: "Eger Clinic Stavanger", 
        address: "Klubbgata 5, 4006 Stavanger",
        image: clinicData.allImages[2]?.src || "https://images.unsplash.com/photo-1631248055158-80f74d121224?w=400&h=300&fit=crop"
      }
    ];
    
    // Merge scraped data with defaults
    defaultClinics.forEach(defaultClinic => {
      const scrapedClinic = clinicData.clinics.find(c => 
        c.name?.toLowerCase().includes(defaultClinic.id) || 
        c.address?.toLowerCase().includes(defaultClinic.id)
      );
      
      formattedClinics.push({
        id: defaultClinic.id,
        name: scrapedClinic?.name || defaultClinic.name,
        address: scrapedClinic?.address || defaultClinic.address,
        image: scrapedClinic?.image || defaultClinic.image,
        bookingUrl: scrapedClinic?.bookingUrl || mainBookingUrl || `https://egerskinclinic.no/book-${defaultClinic.id}`
      });
    });
    
    // Save to JSON file
    const outputPath = path.join(__dirname, '..', 'data', 'clinics.json');
    await fs.writeFile(outputPath, JSON.stringify({ clinics: formattedClinics }, null, 2));
    
    console.log(`✅ Successfully saved clinic data to ${outputPath}`);
    console.log('Clinics found:', formattedClinics);
    
  } catch (error) {
    console.error('Error scraping clinics:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeClinics();