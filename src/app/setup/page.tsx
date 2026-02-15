'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { useAuth } from '@/components/auth';

type Tab = 'canvas' | 'skyward' | 'notifications';

export default function SetupPage() {
  const { connectedServices, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('canvas');
  const [mounted, setMounted] = useState(false);

  // Canvas state
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasTesting, setCanvasTesting] = useState(false);
  const [canvasResult, setCanvasResult] = useState<{ success: boolean; message: string } | null>(null);
  const [canvasSaving, setCanvasSaving] = useState(false);

  // Skyward state
  const [skywardUsername, setSkywardUsername] = useState('');
  const [skywardPassword, setSkywardPassword] = useState('');
  const [skywardConnected, setSkywardConnected] = useState(false);
  const [skywardTesting, setSkywardTesting] = useState(false);
  const [skywardResult, setSkywardResult] = useState<{ success: boolean; message: string } | null>(null);
  const [skywardSaving, setSkywardSaving] = useState(false);

  // Load connection status from auth context
  useEffect(() => {
    setCanvasConnected(connectedServices.includes('canvas'));
    setSkywardConnected(connectedServices.includes('skyward'));
    setMounted(true);
  }, [connectedServices]);

  const testCanvasConnection = async () => {
    setCanvasTesting(true);
    setCanvasResult(null);

    try {
      const response = await fetch('/api/canvas/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: canvasToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setCanvasResult({ success: true, message: `Connected! Found ${data.courseCount} courses.` });
      } else {
        setCanvasResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch {
      setCanvasResult({ success: false, message: 'Failed to test connection' });
    }

    setCanvasTesting(false);
  };

  const saveCanvasToken = async () => {
    setCanvasSaving(true);
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'canvas',
          credentials: { token: canvasToken },
        }),
      });

      if (response.ok) {
        setCanvasConnected(true);
        await refreshSession();
      } else {
        const data = await response.json();
        setCanvasResult({ success: false, message: data.error || 'Failed to save credentials' });
      }
    } catch {
      setCanvasResult({ success: false, message: 'Failed to save credentials' });
    } finally {
      setCanvasSaving(false);
    }
  };

  const disconnectCanvas = async () => {
    try {
      await fetch('/api/credentials?service=canvas', { method: 'DELETE' });
      setCanvasToken('');
      setCanvasConnected(false);
      setCanvasResult(null);
      await refreshSession();
    } catch {
      console.error('Failed to disconnect Canvas');
    }
  };

  const testSkywardConnection = async () => {
    setSkywardTesting(true);
    setSkywardResult(null);

    try {
      const response = await fetch('/api/skyward/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: skywardUsername, password: skywardPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setSkywardResult({ success: true, message: data.message });
      } else {
        setSkywardResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch {
      setSkywardResult({ success: false, message: 'Failed to connect to Skyward' });
    }

    setSkywardTesting(false);
  };

  const saveSkywardCredentials = async () => {
    setSkywardSaving(true);
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'skyward',
          credentials: { username: skywardUsername, password: skywardPassword },
        }),
      });

      if (response.ok) {
        setSkywardConnected(true);
        await refreshSession();
      } else {
        const data = await response.json();
        setSkywardResult({ success: false, message: data.error || 'Failed to save credentials' });
      }
    } catch {
      setSkywardResult({ success: false, message: 'Failed to save credentials' });
    } finally {
      setSkywardSaving(false);
    }
  };

  const disconnectSkyward = async () => {
    try {
      await fetch('/api/credentials?service=skyward', { method: 'DELETE' });
      setSkywardUsername('');
      setSkywardPassword('');
      setSkywardConnected(false);
      setSkywardResult(null);
      await refreshSession();
    } catch {
      console.error('Failed to disconnect Skyward');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Page Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your account connections
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 pt-6">

        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 flex gap-4">
          <div className={`flex-1 p-3 rounded-lg border ${mounted && canvasConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${mounted && canvasConnected ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="font-medium text-gray-900">Canvas</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {!mounted ? 'Loading...' : canvasConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
          <div className={`flex-1 p-3 rounded-lg border ${mounted && skywardConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${mounted && skywardConnected ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="font-medium text-gray-900">Skyward</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {!mounted ? 'Loading...' : skywardConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('canvas')}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
                activeTab === 'canvas'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Canvas
              {mounted && canvasConnected && <span className="ml-2 text-green-500">✓</span>}
            </button>
            <button
              onClick={() => setActiveTab('skyward')}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
                activeTab === 'skyward'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Skyward
              {mounted && skywardConnected && <span className="ml-2 text-green-500">✓</span>}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Notifications
            </button>
          </div>

          <div className="p-8">
            {/* Canvas Tab */}
            {activeTab === 'canvas' && (
              <div>
                {canvasConnected ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">✓</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Canvas Connected
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Your Canvas account is linked and syncing assignments.
                    </p>
                    <button
                      onClick={disconnectCanvas}
                      className="px-6 py-2 rounded-lg font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Disconnect Canvas
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Connect Canvas
                    </h2>

                    <div className="mb-6">
                      <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                        How to get your access token:
                      </h3>
                      <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                        <li>
                          Go to{' '}
                          <a
                            href="https://canyons.instructure.com/profile/settings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline"
                          >
                            Canvas Settings
                          </a>
                        </li>
                        <li>Scroll to &quot;Approved Integrations&quot;</li>
                        <li>Click &quot;+ New Access Token&quot;</li>
                        <li>Name it &quot;School Reminder&quot; and generate</li>
                        <li>Copy and paste the token below</li>
                      </ol>
                    </div>

                    <div className="mb-4">
                      <input
                        type="password"
                        value={canvasToken}
                        onChange={(e) => setCanvasToken(e.target.value)}
                        placeholder="Paste your Canvas token here..."
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    {canvasResult && (
                      <div
                        className={`mb-4 p-4 rounded-lg ${
                          canvasResult.success
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {canvasResult.success ? '✓ ' : '✗ '}
                        {canvasResult.message}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={testCanvasConnection}
                        disabled={!canvasToken || canvasTesting}
                        className="flex-1 px-4 py-3 rounded-lg font-medium border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {canvasTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        onClick={saveCanvasToken}
                        disabled={!canvasResult?.success || canvasSaving}
                        className="flex-1 px-4 py-3 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {canvasSaving ? 'Saving...' : 'Save Connection'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Skyward Tab */}
            {activeTab === 'skyward' && (
              <div>
                {skywardConnected ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">✓</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Skyward Connected
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Your Skyward account is linked for grade tracking.
                    </p>
                    <button
                      onClick={disconnectSkyward}
                      className="px-6 py-2 rounded-lg font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Disconnect Skyward
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Connect Skyward
                    </h2>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        <strong>Secure:</strong> Your Skyward credentials are encrypted using AES-256-GCM
                        and stored securely on the server. They are never stored in plain text.
                      </p>
                    </div>

                    <div className="space-y-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Skyward Username
                        </label>
                        <input
                          type="text"
                          value={skywardUsername}
                          onChange={(e) => setSkywardUsername(e.target.value)}
                          placeholder="Your Skyward username"
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Skyward Password
                        </label>
                        <input
                          type="password"
                          value={skywardPassword}
                          onChange={(e) => setSkywardPassword(e.target.value)}
                          placeholder="Your Skyward password"
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {skywardResult && (
                      <div
                        className={`mb-4 p-4 rounded-lg ${
                          skywardResult.success
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {skywardResult.success ? '✓ ' : '✗ '}
                        {skywardResult.message}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={testSkywardConnection}
                        disabled={!skywardUsername || !skywardPassword || skywardTesting}
                        className="flex-1 px-4 py-3 rounded-lg font-medium border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {skywardTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        onClick={saveSkywardCredentials}
                        disabled={!skywardResult?.success || skywardSaving}
                        className="flex-1 px-4 py-3 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {skywardSaving ? 'Saving...' : 'Save Connection'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Notification Settings
                </h2>
                <NotificationSettings />
              </div>
            )}
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
