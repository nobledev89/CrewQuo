'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { GUMROAD_CONFIG, generateGumroadCheckoutUrl } from '@/lib/gumroad';
import { Check } from 'lucide-react';

export default function PricingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Select the perfect plan for your contractor business. All plans include a 7-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex items-center justify-center space-x-4">
            <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                billingPeriod === 'yearly' ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
            </span>
            {billingPeriod === 'yearly' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                Save 15%
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan) => {
            const displayPrice = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.price;
            const perMonth = billingPeriod === 'yearly' ? (plan.yearlyPrice / 12).toFixed(0) : plan.price;
            
            return (
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
                      <span className="text-5xl font-extrabold text-gray-900">£{displayPrice}</span>
                      <span className="ml-2 text-gray-600">/ {billingPeriod === 'yearly' ? 'year' : 'month'}</span>
                    </div>
                    {billingPeriod === 'yearly' && (
                      <p className="mt-1 text-sm text-gray-500">£{perMonth}/month when billed annually</p>
                    )}
                    <p className="mt-2 text-sm text-blue-600 font-medium">7-day free trial included</p>
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
                          <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Best For */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Perfect for:</h4>
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
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Compare Plans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Features</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Personal</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900 bg-blue-50 rounded-t-lg">
                    Business Starter
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Business Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-4 px-4 text-gray-700">User Accounts</td>
                  <td className="text-center py-4 px-4 text-gray-600">1</td>
                  <td className="text-center py-4 px-4 text-gray-600 bg-blue-50">4</td>
                  <td className="text-center py-4 px-4 text-gray-600">10</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Clients</td>
                  <td className="text-center py-4 px-4 text-gray-600">1</td>
                  <td className="text-center py-4 px-4 text-gray-600 bg-blue-50">3</td>
                  <td className="text-center py-4 px-4 text-gray-600">10</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Projects/Month</td>
                  <td className="text-center py-4 px-4 text-gray-600">3</td>
                  <td className="text-center py-4 px-4 text-gray-600 bg-blue-50">15</td>
                  <td className="text-center py-4 px-4 text-gray-600">40</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Subcontractors</td>
                  <td className="text-center py-4 px-4 text-gray-600">1</td>
                  <td className="text-center py-4 px-4 text-gray-600 bg-blue-50">4</td>
                  <td className="text-center py-4 px-4 text-gray-600">10</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Rate Card Customization</td>
                  <td className="text-center py-4 px-4 text-gray-600">Standard</td>
                  <td className="text-center py-4 px-4 text-gray-600 bg-blue-50">Full</td>
                  <td className="text-center py-4 px-4 text-gray-600">Full</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Invoice/Report Export</td>
                  <td className="text-center py-4 px-4 text-gray-400">-</td>
                  <td className="text-center py-4 px-4 text-gray-400 bg-blue-50">-</td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Performance Tracking</td>
                  <td className="text-center py-4 px-4 text-gray-400">-</td>
                  <td className="text-center py-4 px-4 text-gray-400 bg-blue-50">-</td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-700">Support Response Time</td>
                  <td className="text-center py-4 px-4 text-gray-600">1-3 days</td>
                  <td className="text-center py-4 px-4 text-gray-600 bg-blue-50">1-3 days</td>
                  <td className="text-center py-4 px-4 text-gray-600">1-3 hours</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
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
              <h3 className="font-semibold text-gray-900 mb-2">What happens if I exceed my limits?</h3>
              <p className="text-gray-600 text-sm">
                You'll receive a notification when approaching your limits. You can upgrade your plan at any
                time to access more capacity.
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
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I get a refund?</h3>
              <p className="text-gray-600 text-sm">
                Yes, we offer a 7-day money-back guarantee. If you're not satisfied, contact us within 7 days
                of your purchase for a full refund.
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
