'use client';

import { useState } from 'react';
import { useAuth } from '../../../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TONE_OPTIONS = [
  { value: 'Friendly', label: 'Friendly', description: 'Warm and approachable responses' },
  { value: 'Professional', label: 'Professional', description: 'Formal and business-oriented' },
  { value: 'Helpful', label: 'Helpful', description: 'Solution-focused and supportive' },
  { value: 'Enthusiastic', label: 'Enthusiastic', description: 'Energetic and positive' },
  { value: 'Custom', label: 'Custom', description: 'Define your own tone' },
];

export default function NewAgentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    tone: 'Helpful',
    customTone: '',
    instructions: 'You are a helpful AI assistant for customer support. Provide accurate, friendly, and helpful responses based on the knowledge base provided.',
    primaryColor: '#3B82F6',
    initialGreeting: 'Hi! How can I help you today?',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Agent name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const agentData = {
        name: formData.name,
        tone: formData.tone === 'Custom' ? formData.customTone : formData.tone,
        instructions: formData.instructions,
        chatWidgetConfig: {
          primary_color: formData.primaryColor,
          initial_greeting: formData.initialGreeting,
          position: 'bottom-right',
        },
      };

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (response.ok) {
        const newAgent = await response.json();
        router.push(`/dashboard/agent/${newAgent.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      setError('Failed to create agent');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-semibold text-gray-900">
                SupportGenius
              </Link>
              <nav className="flex space-x-8">
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                  Dashboard
                </Link>
                <span className="text-blue-600 border-b-2 border-blue-600 pb-4">
                  Create Agent
                </span>
              </nav>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500">{user.email}</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Create New AI Agent</h1>
            <p className="mt-1 text-sm text-gray-500">
              Set up your AI assistant&apos;s personality and behavior
            </p>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-800 text-sm">{error}</div>
              </div>
            )}

            {/* Agent Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Agent Name *
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="e.g., Sarah, Support Bot, Customer Helper"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                This name will be displayed to customers when they interact with your agent.
              </p>
            </div>

            {/* Tone Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tone of Voice
              </label>
              <div className="mt-3 space-y-3">
                {TONE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id={option.value}
                        name="tone"
                        type="radio"
                        checked={formData.tone === option.value}
                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor={option.value} className="text-sm font-medium text-gray-700">
                        {option.label}
                      </label>
                      <p className="text-sm text-gray-500">{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {formData.tone === 'Custom' && (
                <div className="mt-3">
                  <label htmlFor="customTone" className="block text-sm font-medium text-gray-700">
                    Custom Tone
                  </label>
                  <input
                    type="text"
                    id="customTone"
                    value={formData.customTone}
                    onChange={(e) => setFormData({ ...formData, customTone: e.target.value })}
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Describe your custom tone..."
                  />
                </div>
              )}
            </div>

            {/* Instructions */}
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                Instructions
              </label>
              <div className="mt-1">
                <textarea
                  id="instructions"
                  rows={4}
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Tell your agent how to behave and respond to customers..."
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                These instructions will guide how your agent responds to customer inquiries.
              </p>
            </div>

            {/* Widget Configuration */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Chat Widget Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">
                    Primary Color
                  </label>
                  <div className="mt-1 flex items-center space-x-3">
                    <input
                      type="color"
                      id="primaryColor"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="h-10 w-20 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block flex-1 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="initialGreeting" className="block text-sm font-medium text-gray-700">
                    Initial Greeting
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="initialGreeting"
                      value={formData.initialGreeting}
                      onChange={(e) => setFormData({ ...formData, initialGreeting: e.target.value })}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="First message shown to visitors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Link
                href="/dashboard"
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 