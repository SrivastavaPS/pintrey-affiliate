'use client';

import { useState, useEffect } from 'react';

interface ScheduledPin {
  id: string;
  title: string;
  image: string;
  description: string;
  affiliateLink: string;
  scheduledDate: string;
  status: 'pending' | 'posted' | 'failed';
}

export default function PostingPage() {
  const [scheduledPins, setScheduledPins] = useState<ScheduledPin[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [pinTitle, setPinTitle] = useState('');
  const [pinDescription, setPinDescription] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [pinImage, setPinImage] = useState('');

  // Load scheduled pins from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('scheduledPins');
    if (saved) {
      setScheduledPins(JSON.parse(saved));
    }
  }, []);

  const saveScheduledPins = (pins: ScheduledPin[]) => {
    setScheduledPins(pins);
    localStorage.setItem('scheduledPins', JSON.stringify(pins));
  };

  const schedulePin = () => {
    if (!pinTitle || !selectedDate || !affiliateLink) return;

    const newPin: ScheduledPin = {
      id: Date.now().toString(),
      title: pinTitle,
      image: pinImage,
      description: pinDescription,
      affiliateLink,
      scheduledDate: selectedDate,
      status: 'pending'
    };

    const updatedPins = [...scheduledPins, newPin];
    saveScheduledPins(updatedPins);

    // Reset form
    setPinTitle('');
    setPinDescription('');
    setAffiliateLink('');
    setPinImage('');
    setSelectedDate('');
  };

  const markAsPosted = (id: string) => {
    const updatedPins = scheduledPins.map(pin =>
      pin.id === id ? { ...pin, status: 'posted' as const } : pin
    );
    saveScheduledPins(updatedPins);
  };

  const deletePin = (id: string) => {
    const updatedPins = scheduledPins.filter(pin => pin.id !== id);
    saveScheduledPins(updatedPins);
  };

  const exportForPosting = (pin: ScheduledPin) => {
    const exportData = {
      title: pin.title,
      description: `${pin.description}\n\n${pin.affiliateLink}`,
      image: pin.image,
      scheduledDate: pin.scheduledDate
    };

    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    alert('Pin data copied to clipboard! Use this with Pinterest scheduling tools.');
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingPins = scheduledPins
    .filter(pin => pin.status === 'pending' && pin.scheduledDate >= today)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Pinterest Posting Scheduler
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
            {/* Schedule New Pin */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Schedule New Pin</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pin Title
                  </label>
                  <input
                    type="text"
                    value={pinTitle}
                    onChange={(e) => setPinTitle(e.target.value)}
                    placeholder="Enter pin title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description & Hashtags
                  </label>
                  <textarea
                    value={pinDescription}
                    onChange={(e) => setPinDescription(e.target.value)}
                    placeholder="Add description and hashtags..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Affiliate Link
                  </label>
                  <input
                    type="url"
                    value={affiliateLink}
                    onChange={(e) => setAffiliateLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pin Image URL (from Pin Creator)
                  </label>
                  <input
                    type="url"
                    value={pinImage}
                    onChange={(e) => setPinImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={today}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={schedulePin}
                  disabled={!pinTitle || !selectedDate || !affiliateLink}
                  className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  Schedule Pin
                </button>
              </div>
            </div>

            {/* Upcoming Pins */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Pins</h2>
              <div className="space-y-4">
                {upcomingPins.length === 0 ? (
                  <p className="text-gray-500">No upcoming pins scheduled.</p>
                ) : (
                  upcomingPins.map((pin) => (
                    <div key={pin.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{pin.title}</h3>
                        <span className="text-sm text-gray-500">
                          {new Date(pin.scheduledDate).toLocaleDateString()}
                        </span>
                      </div>
                      {pin.image && (
                        <img
                          src={pin.image}
                          alt={pin.title}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      )}
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {pin.description}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => exportForPosting(pin)}
                          className="bg-blue-500 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded"
                        >
                          Export
                        </button>
                        <button
                          onClick={() => markAsPosted(pin.id)}
                          className="bg-green-500 hover:bg-green-700 text-white text-sm py-1 px-3 rounded"
                        >
                          Mark Posted
                        </button>
                        <button
                          onClick={() => deletePin(pin.id)}
                          className="bg-red-500 hover:bg-red-700 text-white text-sm py-1 px-3 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Posting Instructions */}
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Posting Instructions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Manual Posting</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Go to Pinterest.com and click "Create"</li>
                  <li>Upload your pin image</li>
                  <li>Add title and description with affiliate link</li>
                  <li>Select appropriate board</li>
                  <li>Publish the pin</li>
                </ol>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Automation Tools</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><strong>Tailwind:</strong> Pinterest scheduling tool</li>
                  <li><strong>Zapier:</strong> Connect with automation workflows</li>
                  <li><strong>Buffer:</strong> Social media scheduling</li>
                  <li><strong>Hootsuite:</strong> Multi-platform scheduling</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Pinterest's API has limited posting capabilities. Most creators use third-party tools or manual posting.
                Always comply with Pinterest's affiliate disclosure policies.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Scheduled
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {scheduledPins.filter(p => p.status === 'pending').length}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Posted
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {scheduledPins.filter(p => p.status === 'posted').length}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002-2V11M9 11h6" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        This Week
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {scheduledPins.filter(p => {
                          const pinDate = new Date(p.scheduledDate);
                          const weekAgo = new Date();
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          return pinDate >= weekAgo && p.status === 'posted';
                        }).length}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Success Rate
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {scheduledPins.length > 0
                          ? Math.round((scheduledPins.filter(p => p.status === 'posted').length / scheduledPins.length) * 100)
                          : 0}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}