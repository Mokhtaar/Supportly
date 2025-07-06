'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';

const PLAN_OPTIONS = [
  {
    name: 'FREE',
    title: 'Free',
    price: '$0',
    features: ['Up to 3 AI agents', 'Up to 5 team members', 'Basic analytics', 'Email support'],
    maxUsers: 5,
    maxAgents: 3,
    recommended: false,
  },
  {
    name: 'STARTER',
    title: 'Starter',
    price: '$29',
    features: ['Up to 10 AI agents', 'Up to 25 team members', 'Advanced analytics', 'Priority support'],
    maxUsers: 25,
    maxAgents: 10,
    recommended: true,
  },
  {
    name: 'PROFESSIONAL',
    title: 'Professional',
    price: '$99',
    features: ['Up to 50 AI agents', 'Up to 100 team members', 'Custom integrations', 'Phone support'],
    maxUsers: 100,
    maxAgents: 50,
    recommended: false,
  },
  {
    name: 'ENTERPRISE',
    title: 'Enterprise',
    price: 'Custom',
    features: ['Unlimited AI agents', 'Unlimited team members', 'Custom solutions', 'Dedicated support'],
    maxUsers: 999999,
    maxAgents: 999999,
    recommended: false,
  },
];

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('FREE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      checkOnboardingStatus();
    }
  }, [user, loading, router]);

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding');
      const data = await response.json();
      
      if (data.hasCompany) {
        // User already has a company, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User needs onboarding
        setCheckingStatus(false);
      }
    } catch (err) {
      console.error('Error checking onboarding status:', err);
      setError('An unexpected error occurred');
      setCheckingStatus(false);
    }
  };

  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCompanyNameChange = (name: string) => {
    setCompanyName(name);
    if (!companySlug || companySlug === generateSlugFromName(companyName)) {
      setCompanySlug(generateSlugFromName(name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companySlug,
          plan: selectedPlan,
        }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create company');
      }
        } catch {
        setError('An unexpected error occurred');
        } finally {
      setIsLoading(false);
    }
  };

  if (loading || checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome to SupportGenius!</h1>
          <p className="mt-2 text-lg text-gray-600">Let&apos;s set up your company account</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Company Details</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Choose Plan</span>
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Information</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (companyName && companySlug) {
                setStep(2);
              }
            }}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    required
                    value={companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    placeholder="Enter your company name"
                  />
                </div>

                <div>
                  <label htmlFor="companySlug" className="block text-sm font-medium text-gray-700">
                    Company URL Identifier
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      supportgenius.com/
                    </span>
                    <input
                      type="text"
                      id="companySlug"
                      required
                      value={companySlug}
                      onChange={(e) => setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm border"
                      placeholder="your-company"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    This will be used for your company&apos;s unique URL and can&apos;t be changed later.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={!companyName || !companySlug}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                ← Back
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {PLAN_OPTIONS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                    selectedPlan === plan.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${plan.recommended ? 'ring-2 ring-blue-500 ring-opacity-20' : ''}`}
                  onClick={() => setSelectedPlan(plan.name)}
                >
                  {plan.recommended && (
                    <div className="absolute -top-2 left-4">
                      <span className="bg-blue-500 text-white px-2 py-1 text-xs font-medium rounded">
                        Recommended
                      </span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="plan"
                      value={plan.name}
                      checked={selectedPlan === plan.name}
                      onChange={() => setSelectedPlan(plan.name)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900">{plan.title}</h3>
                        <span className="text-sm font-medium text-gray-900">{plan.price}</span>
                      </div>
                      <ul className="mt-2 text-xs text-gray-500 space-y-1">
                        {plan.features.map((feature, index) => (
                          <li key={index}>• {feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Create Company'
              )}
            </button>

            <p className="mt-4 text-xs text-gray-500 text-center">
              You can upgrade or downgrade your plan at any time from your account settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 