'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  totalClicks: number;
  totalEarnings: number;
  totalPins: number;
  conversionRate: number;
  topProducts: Array<{
    title: string;
    clicks: number;
    earnings: number;
  }>;
  monthlyData: Array<{
    month: string;
    clicks: number;
    earnings: number;
    pins: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'click' | 'pin_posted' | 'earning';
    description: string;
    timestamp: string;
    value?: number;
  }>;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalClicks: 0,
    totalEarnings: 0,
    totalPins: 0,
    conversionRate: 0,
    topProducts: [],
    monthlyData: [],
    recentActivity: []
  });

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = () => {
    // Load data from localStorage
    const links = JSON.parse(localStorage.getItem('affiliateLinks') || '[]');
    const scheduledPins = JSON.parse(localStorage.getItem('scheduledPins') || '[]');

    // Calculate metrics
    const totalClicks = links.reduce((sum: number, link: any) => sum + link.clicks, 0);
    const totalPins = scheduledPins.filter((pin: any) => pin.status === 'posted').length;

    // Mock earnings calculation (2% average commission)
    const totalEarnings = (totalClicks * 0.02 * 25); // Assuming $25 avg order value
    const conversionRate = totalClicks > 0 ? (totalEarnings / (totalClicks * 25)) * 100 : 0;

    // Top products
    const topProducts = links
      .sort((a: any, b: any) => b.clicks - a.clicks)
      .slice(0, 5)
      .map((link: any) => ({
        title: link.productTitle,
        clicks: link.clicks,
        earnings: link.clicks * 0.02 * 25
      }));

    // Monthly data (mock for last 6 months)
    const monthlyData = [
      { month: 'Nov', clicks: Math.floor(totalClicks * 0.1), earnings: totalEarnings * 0.1, pins: Math.floor(totalPins * 0.1) },
      { month: 'Dec', clicks: Math.floor(totalClicks * 0.15), earnings: totalEarnings * 0.15, pins: Math.floor(totalPins * 0.15) },
      { month: 'Jan', clicks: Math.floor(totalClicks * 0.2), earnings: totalEarnings * 0.2, pins: Math.floor(totalPins * 0.2) },
      { month: 'Feb', clicks: Math.floor(totalClicks * 0.25), earnings: totalEarnings * 0.25, pins: Math.floor(totalPins * 0.25) },
      { month: 'Mar', clicks: Math.floor(totalClicks * 0.2), earnings: totalEarnings * 0.2, pins: Math.floor(totalPins * 0.2) },
      { month: 'Apr', clicks: Math.floor(totalClicks * 0.1), earnings: totalEarnings * 0.1, pins: Math.floor(totalPins * 0.1) }
    ];

    // Recent activity
    const recentActivity = [
      ...links.slice(0, 3).map((link: any) => ({
        id: `click-${link.id}`,
        type: 'click' as const,
        description: `Click on ${link.productTitle}`,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        value: link.clicks
      })),
      ...scheduledPins.slice(0, 2).filter((pin: any) => pin.status === 'posted').map((pin: any) => ({
        id: `pin-${pin.id}`,
        type: 'pin_posted' as const,
        description: `Posted pin: ${pin.title}`,
        timestamp: pin.scheduledDate,
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

    setAnalytics({
      totalClicks,
      totalEarnings,
      totalPins,
      conversionRate,
      topProducts,
      monthlyData,
      recentActivity
    });
  };

  const exportAnalytics = () => {
    const data = {
      ...analytics,
      exportedAt: new Date().toISOString(),
      timeRange
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `affiliate-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics Dashboard
            </h1>
            <div className="flex gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <button
                onClick={exportAnalytics}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Export Data
              </button>
              <a
                href="/"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Clicks
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analytics.totalClicks.toLocaleString()}
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
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Estimated Earnings
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${analytics.totalEarnings.toFixed(2)}
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
                    <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Pins Posted
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analytics.totalPins}
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
                    <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Conversion Rate
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analytics.conversionRate.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Monthly Trends Chart (Simple bars) */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Performance</h2>
              <div className="space-y-4">
                {analytics.monthlyData.map((month) => (
                  <div key={month.month} className="flex items-center">
                    <div className="w-12 text-sm font-medium text-gray-500">{month.month}</div>
                    <div className="flex-1 ml-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Clicks: {month.clicks}</div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${(month.clicks / Math.max(...analytics.monthlyData.map(m => m.clicks))) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-green-600 w-16 text-right">
                          ${month.earnings.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Products</h2>
              <div className="space-y-4">
                {analytics.topProducts.length === 0 ? (
                  <p className="text-gray-500">No product data yet. Start tracking clicks!</p>
                ) : (
                  analytics.topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{product.title}</h3>
                        <p className="text-xs text-gray-500">{product.clicks} clicks</p>
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        ${product.earnings.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {analytics.recentActivity.length === 0 ? (
                <p className="text-gray-500">No recent activity.</p>
              ) : (
                analytics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'click' ? 'bg-blue-100' :
                      activity.type === 'pin_posted' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {activity.type === 'click' && (
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      {activity.type === 'pin_posted' && (
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                      {activity.type === 'earning' && (
                        <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                        {activity.value && ` • ${activity.value} clicks`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">💡 Recommendations</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Focus on products with high click-through rates</li>
                  <li>• Post consistently to maintain engagement</li>
                  <li>• Use trending hashtags in pin descriptions</li>
                  <li>• Test different pin designs and layouts</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">📊 Key Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg. clicks per pin:</span>
                    <span className="font-medium">{analytics.totalPins > 0 ? (analytics.totalClicks / analytics.totalPins).toFixed(1) : '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Best performing month:</span>
                    <span className="font-medium">
                      {analytics.monthlyData.length > 0 ? analytics.monthlyData.reduce((best, month) =>
                        month.earnings > best.earnings ? month : best
                      ).month : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Growth trend:</span>
                    <span className="font-medium text-green-600">
                      {analytics.monthlyData.length > 1 ?
                        ((analytics.monthlyData[analytics.monthlyData.length - 1].earnings -
                          analytics.monthlyData[0].earnings) / analytics.monthlyData[0].earnings * 100).toFixed(1) + '%' : 'N/A'
                      }
                    </span>
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