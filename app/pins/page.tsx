'use client';

import { useState, useRef, useEffect } from 'react';

interface Product {
  id: string;
  title: string;
  image: string;
  price: string;
  affiliateLink: string;
}

export default function PinsPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pinTitle, setPinTitle] = useState('');
  const [pinDescription, setPinDescription] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock product selection - in real app, this would come from product search
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

  const generatePin = () => {
    if (!selectedProduct || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for Pinterest (2:3 ratio, 1000x1500)
    canvas.width = 1000;
    canvas.height = 1500;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(1, '#e9ecef');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load and draw product image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw product image (centered, taking up most of the pin)
      const imgWidth = 800;
      const imgHeight = 800;
      const imgX = (canvas.width - imgWidth) / 2;
      const imgY = 100;

      ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);

      // Add title
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      const titleY = imgY + imgHeight + 80;
      ctx.fillText(pinTitle || selectedProduct.title.substring(0, 30) + '...', canvas.width / 2, titleY);

      // Add price
      ctx.fillStyle = '#28a745';
      ctx.font = 'bold 36px Arial';
      ctx.fillText(selectedProduct.price, canvas.width / 2, titleY + 60);

      // Add description
      ctx.fillStyle = '#6c757d';
      ctx.font = '24px Arial';
      const descLines = pinDescription.split('\n');
      let descY = titleY + 120;
      descLines.forEach(line => {
        ctx.fillText(line, canvas.width / 2, descY);
        descY += 30;
      });

      // Add call to action
      ctx.fillStyle = '#007bff';
      ctx.font = 'bold 32px Arial';
      ctx.fillText('Shop Now →', canvas.width / 2, canvas.height - 100);

      // Convert to data URL
      const dataURL = canvas.toDataURL('image/png');
      setGeneratedImage(dataURL);
    };
    img.src = selectedProduct.image;
  };

  const downloadPin = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.download = 'pinterest-pin.png';
    link.href = generatedImage;
    link.click();
  };

  const copyLink = () => {
    if (selectedProduct) {
      navigator.clipboard.writeText(selectedProduct.affiliateLink);
      alert('Affiliate link copied!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Pin Creator
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side - Form */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Product
                </label>
                <select
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const product = mockProducts.find(p => p.id === e.target.value);
                    setSelectedProduct(product || null);
                    setPinTitle('');
                    setPinDescription('');
                    setGeneratedImage(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a product...</option>
                  {mockProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.title.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pin Title (optional)
                    </label>
                    <input
                      type="text"
                      value={pinTitle}
                      onChange={(e) => setPinTitle(e.target.value)}
                      placeholder="Custom title for your pin"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pin Description
                    </label>
                    <textarea
                      value={pinDescription}
                      onChange={(e) => setPinDescription(e.target.value)}
                      placeholder="Add hashtags and description..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={generatePin}
                      className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded"
                    >
                      Generate Pin
                    </button>
                    <button
                      onClick={copyLink}
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-6 rounded"
                    >
                      Copy Affiliate Link
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Right side - Preview */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Pin Preview</h3>
              <div className="bg-white p-4 rounded-lg shadow">
                {generatedImage ? (
                  <div className="space-y-4">
                    <img
                      src={generatedImage}
                      alt="Generated Pin"
                      className="w-full max-w-sm mx-auto border border-gray-300 rounded"
                    />
                    <button
                      onClick={downloadPin}
                      className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Download Pin Image
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Select a product and click "Generate Pin" to see preview</p>
                  </div>
                )}
              </div>

              {/* Hidden canvas for image generation */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}