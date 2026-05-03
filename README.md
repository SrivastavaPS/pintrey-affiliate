# Pinterest Affiliate Marketing Automation App

This application automates the process of creating and managing Pinterest affiliate marketing campaigns. It helps users find trending Amazon products, generate affiliate links, create optimized pins, schedule posts, and track performance.

## Features

- **Product Research**: Search and browse Amazon products with real API integration
- **Affiliate Link Generation**: Convert URLs to affiliate links with automatic tagging
- **Pin Creation**: Design custom Pinterest pins with canvas-based image generation
- **Link Management**: Organize and track all affiliate links with click monitoring
- **Posting Scheduler**: Schedule pins and manage posting workflow
- **Analytics Dashboard**: Track performance and optimize campaigns
- **Mobile Responsive**: Works on desktop and mobile devices

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see .env.local)
4. Run the development server: `npm run dev`

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Amazon Product Advertising API (Required for real product data)
AMAZON_ACCESS_KEY=your_amazon_access_key_here
AMAZON_SECRET_KEY=your_amazon_secret_key_here
AMAZON_ASSOCIATE_TAG=your_associate_tag_here
AMAZON_REGION=us-east-1

# Optional: URL Shortener (e.g., Bitly)
BITLY_ACCESS_TOKEN=your_bitly_token_here
```

### Getting Amazon API Credentials

1. Sign up for Amazon Associates: https://affiliate-program.amazon.com/
2. Apply for Product Advertising API access
3. Get your Access Key and Secret Key from AWS IAM
4. Use your Associate Tag from Amazon Associates

## Usage

1. **Dashboard**: Overview of all features
2. **Product Research**: Search for trending products
3. **Pin Creator**: Design pins with product images and affiliate links
4. **Link Manager**: Generate and organize affiliate links
5. **Posting Scheduler**: Plan and track your Pinterest posting schedule
6. **Analytics Dashboard**: Monitor performance, earnings, and optimize strategies

## Pinterest Integration

Since Pinterest's API has limited posting capabilities:
- Use manual posting with the generated pins
- Integrate with third-party tools like Tailwind or Zapier
- Follow Pinterest's affiliate disclosure guidelines

## Technologies

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **APIs**: Amazon Product Advertising API
- **Storage**: Browser LocalStorage (for demo; use database for production)
- **Image Generation**: HTML5 Canvas

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Deployment

Deploy to Vercel, Netlify, or any Node.js hosting platform.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This tool is for educational and personal use. Always comply with Amazon Associates and Pinterest terms of service. Affiliate marketing success depends on content quality, audience engagement, and platform algorithms.
