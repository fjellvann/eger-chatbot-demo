# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

### Data Scraping
- `node scripts/scraper.js` - Run the Playwright scraper to fetch treatment data from egerskinclinic.no

## Architecture

This is a Next.js 15 application using the App Router pattern with TypeScript and Tailwind CSS.

### Key Technologies
- **Next.js 15.4.6** with App Router
- **React 19.1.0** 
- **TypeScript** with strict mode enabled
- **Tailwind CSS v4** for styling
- **Radix UI** components (@radix-ui/react-scroll-area)
- **Lucide React** for icons
- **Playwright** for web scraping

### Project Structure
- `/app` - Next.js App Router pages and layouts
  - `layout.tsx` - Root layout with Geist font configuration
  - `page.tsx` - Homepage component
  - `globals.css` - Global styles with Tailwind directives
- `/scripts` - Utility scripts
  - `scraper.js` - Playwright scraper for egerskinclinic.no treatments
- `/public` - Static assets (SVG icons)
- `/data` - Scraped treatment data (created by scraper)

### TypeScript Configuration
- Target: ES2017
- Strict mode enabled
- Path alias: `@/*` maps to root directory
- Module resolution: bundler

### Scraper Functionality
The `scripts/scraper.js` file uses Playwright to:
1. Scrape treatment information from egerskinclinic.no
2. Categorize treatments (laser, injectable, facial, advanced, specialized)
3. Save data to `/data/treatments.json`
4. Limited to first 20 treatment pages to avoid overload

## Development Notes

When implementing the chatbot functionality:
- The scraped treatment data should be loaded from `/data/treatments.json`
- Consider implementing API routes in `/app/api` for chatbot interactions
- The project uses Tailwind CSS v4 with PostCSS configuration
- UI components should utilize the existing Radix UI and Lucide React dependencies