'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { GUMROAD_CONFIG, generateGumroadCheckoutUrl } from '@/lib/gumroad';

export default function PricingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
      } else {
        // Redirect to login if not authenticated
        router.push('/login?redirect=/pricing');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubscribe = (tierName: string) => {
    if (!userId) {
      router.push('/login?redirect=/pricing');
      return;
    }

    // Generate Gumroad checkout URL with user ID
    const checkoutUrl = generateGumroadCheckoutUrl(tierName, userId, userEmail || undefined);
    
    // Redirect to Gumroad checkout
    window.location.href = checkoutUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const plans = [
    {
      ...GUMROAD_CONFIG.plans.starter,
      popular: false,
      cta: 'Start Free Trial',
    },
    {
      ...GUMROAD_CONFIG.plans.professional,
      popular: true,
      cta: 'Start Free Trial',
    },
    {
      ...GUMROAD_CONFIG.plans.enterprise,
      popular: false,
      cta: 'Start Free Trial',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Select the perfect plan for your contractor business. All plans include a 7-day free trial.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border-2 ${
                plan.popular
                  ? 'border-blue-500 shadow-2xl scale-105 z-10'
                  : 'border-gray-200 shadow-lg'
              } bg-white overflow-hidden transition-transform hover:scale-105 hover:shadow-2xl`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                  Most Popular
                </div>
              )}

              <div className="p-8">
                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-6">{plan.tagline}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-extrabold text-gray-900">£{plan.price}</span>
                    <span className="ml-2 text-gray-600">/ {plan.billingPeriod}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">7-day free trial included</p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan.tierName)}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-lg transition-colors ${
                    plan.popular
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {plan.cta}
                </button>

                {/* Features */}
                <div className="mt-8">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">What's included:</h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <span className="text-green-500 mr-3 flex-shrink-0">
                          {feature.startsWith('✅') ? feature.substring(0, 2) : '✓'}
                        </span>
                        <span className="text-gray-700 text-sm">
                          {feature.replace(/^✅\s*/, '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Best For */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Best for:</h4>
                  <ul className="space-y-1">
                    {plan.bestFor.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-sm text-gray-600">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ/Info Section */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">How does the free trial work?</h3>
              <p className="text-gray-600 text-sm">
                All plans include a 7-day free trial. You won't be charged until the trial period ends.
                Cancel anytime during the trial with no charges.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change plans later?</h3>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your
                next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600 text-sm">
                We accept all major credit cards, debit cards, and PayPal through our secure payment processor
                Gumroad.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is my data secure?</h3>
              <p className="text-gray-600 text-sm">
                Absolutely. We use industry-standard encryption and security measures. Your payment information
                is processed securely by Gumroad.
              </p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
