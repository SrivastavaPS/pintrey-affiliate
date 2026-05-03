'use client';

import { useState, useEffect } from 'react';

interface AffiliateLink {
  id: string;
  productId: string;
  productTitle: string;
  originalUrl: string;
  shortUrl: string;
  createdAt: string;
  clicks: number;
}

export default function LinksPage() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // Load saved links from localStorage
  useEffect(() => {
    const savedLinks = localStorage.getItem('affiliateLinks');
    if (savedLinks) {
      setLinks(JSON.parse(savedLinks));
    }
  }, []);

  // Save links to localStorage
  const saveLinks = (updatedLinks: AffiliateLink[]) => {
    setLinks(updatedLinks);
    localStorage.setItem('affiliateLinks', JSON.stringify(updatedLinks));
  };

  const generateAffiliateLink = async () => {
    if (!newLinkUrl.trim() || !newLinkTitle.trim()) return;

    setLoading(true);
    try {
      // Mock affiliate link generation - replace with actual Amazon API
      const affiliateId = 'yourassociateid'; // Replace with your actual ID
      const affiliateUrl = `${newLinkUrl}&tag=${affiliateId}`;

      // Mock URL shortening
      const shortUrl = `https://bit.ly/${Math.random().toString(36).substring(2, 8)}`;

      const newLink: AffiliateLink = {
        id: Date.now().toString(),
        productId: Math.random().toString(36).substring(2, 8),
        productTitle: newLinkTitle,
        originalUrl: affiliateUrl,
        shortUrl,
        createdAt: new Date().toISOString(),
        clicks: 0
      };

      const updatedLinks = [...links, newLink];
      saveLinks(updatedLinks);

      setNewLinkUrl('');
      setNewLinkTitle('');
    } catch (error) {
      console.error('Error generating link:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('Link copied!');
  };

  const deleteLink = (id: string) => {
    const updatedLinks = links.filter(link => link.id !== id);
    saveLinks(updatedLinks);
  };

  const trackClick = (id: string) => {
    const updatedLinks = links.map(link =>
      link.id === id ? { ...link, clicks: link.clicks + 1 } : link
    );
    saveLinks(updatedLinks);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Affiliate Link Manager
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
          {/* Add New Link Form */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate New Affiliate Link</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Title
                </label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amazon Product URL
                </label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://www.amazon.com/dp/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={generateAffiliateLink}
              disabled={loading || !newLinkUrl.trim() || !newLinkTitle.trim()}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Affiliate Link'}
            </button>
          </div>

          {/* Links List */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Your Affiliate Links</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {links.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <p>No affiliate links yet. Generate your first link above!</p>
                </div>
              ) : (
                links.map((link) => (
                  <div key={link.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{link.productTitle}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Created: {new Date(link.createdAt).toLocaleDateString()} | Clicks: {link.clicks}
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Short URL:</span> {link.shortUrl}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            <span className="font-medium">Full URL:</span> {link.originalUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => copyLink(link.shortUrl)}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Copy Short
                        </button>
                        <button
                          onClick={() => copyLink(link.originalUrl)}
                          className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Copy Full
                        </button>
                        <button
                          onClick={() => trackClick(link.id)}
                          className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Track Click
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          {links.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Links
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {links.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Clicks
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {links.reduce((sum, link) => sum + link.clicks, 0)}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Avg Clicks/Link
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {links.length > 0 ? (links.reduce((sum, link) => sum + link.clicks, 0) / links.length).toFixed(1) : '0'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}