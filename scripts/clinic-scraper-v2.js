const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function scrapeClinics() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Fetching clinic information from egerskinclinic.no...');
  
  try {
    const clinics = [];
    
    // Visit Karl Johan clinic page
    console.log('Visiting Karl Johan clinic page...');
    await page.goto('https://egerskinclinic.no/klinikker/karl-johan/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const karlJohanData = await page.evaluate(() => {
      const name = document.querySelector('h1, .hero-title, .page-title')?.textContent?.trim() || 'Karl Johan';
      const address = document.querySelector('.address, [class*="address"]')?.textContent?.trim() || 
                      Array.from(document.querySelectorAll('p')).find(p => p.textContent?.includes('Øvre Slottsgate'))?.textContent?.trim() ||
                      'Øvre Slottsgate 27, 0157 Oslo';
      const phone = document.querySelector('.phone, [href^="tel:"]')?.textContent?.trim() || '22 33 60 60';
      
      // Find images
      const images = Array.from(document.querySelectorAll('img')).filter(img => 
        img.src && !img.src.includes('logo') && !img.src.includes('icon') && img.width > 100
      );
      const image = images[0]?.src || '';
      
      // Look for booking button
      const bookingLink = document.querySelector('a[href*="book"], a[href*="bestill"], .booking-button')?.href;
      
      return { name, address, phone, image, bookingLink };
    });
    
    clinics.push({
      id: 'karl-johan',
      name: 'Eger Clinic Karl Johan',
      address: karlJohanData.address || 'Øvre Slottsgate 27, 0157 Oslo',
      phone: karlJohanData.phone,
      image: karlJohanData.image || 'https://egerskinclinic.no/wp-content/uploads/2023/03/Sane_Eger-skin-clinic_Kyrre-Sundal-08.jpg',
      bookingUrl: karlJohanData.bookingLink || 'https://booking.arenacloudapp.com/m2/consumer/772067?languageCode=no'
    });
    
    // Visit Sandvika clinic page
    console.log('Visiting Sandvika clinic page...');
    await page.goto('https://egerskinclinic.no/klinikker/sandvika/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const sandvikaData = await page.evaluate(() => {
      const name = document.querySelector('h1, .hero-title, .page-title')?.textContent?.trim() || 'Sandvika';
      const address = document.querySelector('.address, [class*="address"]')?.textContent?.trim() || 
                      Array.from(document.querySelectorAll('p')).find(p => p.textContent?.includes('Sandvika'))?.textContent?.trim() ||
                      'Claude Monets allé 2, 1338 Sandvika';
      const phone = document.querySelector('.phone, [href^="tel:"]')?.textContent?.trim() || '902 57 677';
      
      // Find images
      const images = Array.from(document.querySelectorAll('img')).filter(img => 
        img.src && !img.src.includes('logo') && !img.src.includes('icon') && img.width > 100
      );
      const image = images[0]?.src || '';
      
      // Look for booking button
      const bookingLink = document.querySelector('a[href*="book"], a[href*="bestill"], .booking-button')?.href;
      
      return { name, address, phone, image, bookingLink };
    });
    
    clinics.push({
      id: 'sandvika',
      name: 'Eger Clinic Sandvika',
      address: sandvikaData.address || 'Claude Monets allé 2, 1338 Sandvika',
      phone: sandvikaData.phone,
      image: sandvikaData.image || 'https://egerskinclinic.no/wp-content/uploads/2023/03/IMG_1487-kopi.jpeg',
      bookingUrl: sandvikaData.bookingLink || 'https://booking.arenacloudapp.com/m2/consumer/772067?languageCode=no'
    });
    
    // Visit Majorstuen clinic page
    console.log('Visiting Majorstuen clinic page...');
    await page.goto('https://egerskinclinic.no/klinikker/majorstuen/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const majorstuenData = await page.evaluate(() => {
      const name = document.querySelector('h1, .hero-title, .page-title')?.textContent?.trim() || 'Majorstuen';
      const address = document.querySelector('.address, [class*="address"]')?.textContent?.trim() || 
                      Array.from(document.querySelectorAll('p')).find(p => p.textContent?.includes('Majorstuen') || p.textContent?.includes('Sørkedalsveien'))?.textContent?.trim() ||
                      'Sørkedalsveien 10, 0369 Oslo';
      const phone = document.querySelector('.phone, [href^="tel:"]')?.textContent?.trim() || '23 21 54 00';
      
      // Find images
      const images = Array.from(document.querySelectorAll('img')).filter(img => 
        img.src && !img.src.includes('logo') && !img.src.includes('icon') && img.width > 100
      );
      const image = images[0]?.src || '';
      
      // Look for booking button
      const bookingLink = document.querySelector('a[href*="book"], a[href*="bestill"], .booking-button')?.href;
      
      return { name, address, phone, image, bookingLink };
    });
    
    clinics.push({
      id: 'majorstuen',
      name: 'Eger Clinic Majorstuen',
      address: majorstuenData.address || 'Sørkedalsveien 10, 0369 Oslo',
      phone: majorstuenData.phone,
      image: majorstuenData.image || 'https://egerskinclinic.no/wp-content/uploads/2023/03/Eger-Majorstuen.jpeg',
      bookingUrl: majorstuenData.bookingLink || 'https://booking.arenacloudapp.com/m2/consumer/772067?languageCode=no'
    });
    
    // Save to JSON file
    const outputPath = path.join(__dirname, '..', 'data', 'clinics.json');
    await fs.writeFile(outputPath, JSON.stringify({ clinics }, null, 2));
    
    console.log(`✅ Successfully saved clinic data to ${outputPath}`);
    console.log('Clinics found:', JSON.stringify(clinics, null, 2));
    
  } catch (error) {
    console.error('Error scraping clinics:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeClinics();