'use client';

import { useState } from 'react';

interface Product {
  id: string;
  title: string;
  image: string;
  price: string;
  affiliateLink: string;
}

export default function ProductsPage() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const searchProducts = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/products?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAffiliateLink = (productId: string) => {
    // Mock affiliate link generation
    return `https://www.amazon.com/dp/${productId}?tag=yourassociateid`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Product Research
            </h1>
            <a
              href="/"
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
              />
              <button
                onClick={searchProducts}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white overflow-hidden shadow rounded-lg">
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
                    {product.title}
                  </h3>
                  <p className="text-xl font-bold text-green-600 mb-4">
                    {product.price}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={product.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-center"
                    >
                      View on Amazon
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(product.affiliateLink)}
                      className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {products.length === 0 && !loading && query && (
            <div className="text-center py-12">
              <p className="text-gray-500">No products found. Try a different search term.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}