import { NextRequest, NextResponse } from 'next/server';
import { AmazonPaapi, SearchItemsRequest } from 'amazon-paapi';

interface Product {
  id: string;
  title: string;
  image: string;
  price: string;
  affiliateLink: string;
}

const amazonPaapi = new AmazonPaapi({
  accessKey: process.env.AMAZON_ACCESS_KEY!,
  secretKey: process.env.AMAZON_SECRET_KEY!,
  partnerTag: process.env.AMAZON_ASSOCIATE_TAG!,
  partnerType: 'Associates',
  region: process.env.AMAZON_REGION || 'us-east-1',
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const searchRequest: SearchItemsRequest = {
      Keywords: query,
      SearchIndex: 'All',
      ItemCount: 10,
      Resources: [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'ItemInfo.ExternalIds.ASIN'
      ],
    };

    const response = await amazonPaapi.searchItems(searchRequest);

    if (!response.SearchResult || !response.SearchResult.Items) {
      return NextResponse.json({ products: [], query, totalResults: 0 });
    }

    const products: Product[] = response.SearchResult.Items.map((item: any) => {
      const asin = item.ItemInfo?.ExternalIds?.ASIN?.[0] || item.ASIN;
      const title = item.ItemInfo?.Title?.DisplayValue || 'Unknown Product';
      const image = item.Images?.Primary?.Medium?.URL || '';
      const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || 'Price not available';

      return {
        id: asin,
        title: title.length > 100 ? title.substring(0, 100) + '...' : title,
        image,
        price,
        affiliateLink: `https://www.amazon.com/dp/${asin}?tag=${process.env.AMAZON_ASSOCIATE_TAG}`,
      };
    }).filter(product => product.image && product.title !== 'Unknown Product');

    return NextResponse.json({
      products,
      query,
      totalResults: products.length
    });
  } catch (error) {
    console.error('Amazon API Error:', error);

    // Fallback to mock data if API fails
    const mockProducts: Product[] = [
      {
        id: 'B08N5WRWNW',
        title: 'Apple iPhone 15 Pro Max, 256GB, Natural Titanium',
        image: 'https://images-na.ssl-images-amazon.com/images/I/81fxjeu8fdL._AC_SL1500_.jpg',
        price: '$1,199.00',
        affiliateLink: 'https://www.amazon.com/dp/B08N5WRWNW?tag=yourassociateid'
      },
      {
        id: 'B08PPDJWC8',
        title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
        image: 'https://images-na.ssl-images-amazon.com/images/I/61j3z5+S2+L._AC_SL1500_.jpg',
        price: '$349.99',
        affiliateLink: 'https://www.amazon.com/dp/B08PPDJWC8?tag=yourassociateid'
      }
    ];

    const filteredProducts = mockProducts.filter(product =>
      product.title.toLowerCase().includes(query.toLowerCase())
    );

    return NextResponse.json({
      products: filteredProducts,
      query,
      totalResults: filteredProducts.length,
      note: 'Using mock data - configure Amazon API credentials for real results'
    });
  }
}