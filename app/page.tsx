'use client';

import { ArrowRight, CheckCircle2, Users, Clock, TrendingUp, Shield, Zap, FileText, Calendar, DollarSign, BarChart3, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                CrewQuo
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition">Features</a>
              <a href="/introduction" className="text-slate-600 hover:text-slate-900 transition">Platform Guide</a>
              <a href="/docs" className="text-slate-600 hover:text-slate-900 transition">Documentation</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition">Pricing</a>
              <a href="/login" className="text-slate-600 hover:text-slate-900 transition">Login</a>
              <a
                href="/signup"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full mb-8">
              <Zap className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-sm font-semibold text-blue-600">The Future of Contractor Management</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
              Manage Your Contractors
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Like Never Before
              </span>
            </h1>
            
            <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              CrewQuo is the all-in-one platform that streamlines project management, time tracking, 
              and billing for contractor companies. Save time, reduce errors, and maximize profits.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/signup"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            <div className="mt-16 flex flex-wrap justify-center items-center gap-8 text-sm text-slate-500">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                No credit card required
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                7-day free trial
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Projects', value: '10K+', icon: BarChart3 },
              { label: 'Hours Tracked', value: '2M+', icon: Clock },
              { label: 'Companies', value: '500+', icon: Users },
              { label: 'Cost Savings', value: '35%', icon: TrendingUp },
            ].map((stat, index) => (
              <div
                key={index}
                className="text-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300"
              >
                <stat.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need in One Place
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Powerful features designed specifically for contractor management
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Multi-Tenant Isolation',
                description: 'Complete data separation for each company. Your data stays yours, always secure and private.',
                color: 'from-blue-500 to-blue-600',
              },
              {
                icon: Clock,
                title: 'Smart Time Tracking',
                description: 'Shift-based time logs with automatic cost and billing calculations. Say goodbye to spreadsheets.',
                color: 'from-indigo-500 to-indigo-600',
              },
              {
                icon: DollarSign,
                title: 'Dynamic Rate Cards',
                description: 'Complex rate resolution based on role, shift type, and date. Accurate billing every time.',
                color: 'from-purple-500 to-purple-600',
              },
              {
                icon: FileText,
                title: 'Expense Management',
                description: 'Track expenses and manage project costs. Approve, reject, and report with ease.',
                color: 'from-pink-500 to-pink-600',
              },
              {
                icon: Shield,
                title: 'Role-Based Access',
                description: 'Granular permissions for admins, managers, and subcontractors. Control who sees what.',
                color: 'from-red-500 to-red-600',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time KPIs',
                description: 'Project margins, costs, and profitability at your fingertips. Make data-driven decisions.',
                color: 'from-orange-500 to-orange-600',
              },
              {
                icon: Calendar,
                title: 'Project Management',
                description: 'Assign subcontractors to projects, track progress, and manage deliverables seamlessly.',
                color: 'from-green-500 to-green-600',
              },
              {
                icon: CheckCircle2,
                title: 'Approval Workflows',
                description: 'Streamlined approval process for time logs and expenses. Maintain control and audit trails.',
                color: 'from-teal-500 to-teal-600',
              },
              {
                icon: Zap,
                title: 'Firebase Powered',
                description: 'Built on Google Cloud infrastructure. Fast, reliable, and scales with your business.',
                color: 'from-yellow-500 to-yellow-600',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group p-8 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
                Why Contractor Companies Choose CrewQuo
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Stop juggling spreadsheets and emails. CrewQuo brings everything together.
              </p>
              
              <div className="space-y-6">
                {[
                  {
                    title: 'Save 15+ Hours Per Week',
                    description: 'Automate time tracking, billing calculations, and reporting. Focus on growing your business.',
                  },
                  {
                    title: 'Reduce Billing Errors by 95%',
                    description: 'Automated rate calculations eliminate manual errors and ensure accurate invoicing.',
                  },
                  {
                    title: 'Improve Cash Flow',
                    description: 'Faster approvals and real-time visibility mean you get paid sooner.',
                  },
                  {
                    title: 'Scale Without Chaos',
                    description: 'Built for growth. Manage 10 or 10,000 subcontractors with the same ease.',
                  },
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{benefit.title}</h3>
                      <p className="text-slate-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-3xl transform rotate-3"></div>
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 transform -rotate-1">
                <div className="space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                  <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-3 bg-blue-300 rounded w-1/3"></div>
                      <div className="h-3 bg-green-300 rounded w-1/4"></div>
                    </div>
                    <div className="h-24 bg-white rounded-lg shadow-sm"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="h-20 bg-slate-100 rounded-lg"></div>
                    <div className="h-20 bg-slate-100 rounded-lg"></div>
                    <div className="h-20 bg-slate-100 rounded-lg"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
              Start free, scale as you grow. Save 15% with annual billing.
            </p>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white rounded-full p-1 shadow-md">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 relative ${
                  billingCycle === 'annual'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annual
                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">Save 15%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                name: 'Personal',
                monthlyPrice: 99,
                annualPrice: 84,
                description: 'Perfect for solopreneurs',
                features: [
                  '1 user account',
                  '1 client',
                  '3 projects/month',
                  '1 subcontractor',
                  'Standard rate card template',
                  'Standard support (1-3 days)',
                ],
                cta: 'Start Free Trial',
                highlight: false,
              },
              {
                name: 'Business Starter',
                monthlyPrice: 249,
                annualPrice: 199,
                description: 'For growing businesses',
                features: [
                  '4 user accounts',
                  '3 clients',
                  '15 projects/month',
                  '4 subcontractor accounts',
                  'Full rate card customization',
                  'Standard support (1-3 days)',
                ],
                cta: 'Start Free Trial',
                highlight: true,
              },
              {
                name: 'Business Pro',
                monthlyPrice: 499,
                annualPrice: 399,
                description: 'For established teams',
                features: [
                  '10 user accounts',
                  '10 clients',
                  '40 projects/month',
                  '10 subcontractor accounts',
                  'Invoice/Reporting Export',
                  'Performance Tracking',
                  'Premium support (1-3 hours)',
                ],
                cta: 'Start Free Trial',
                highlight: false,
              },
            ].map((plan, index) => {
              const displayPrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
              const savings = plan.monthlyPrice > 0 ? Math.round(((plan.monthlyPrice - plan.annualPrice) / plan.monthlyPrice) * 100) : 0;
              
              return (
                <div
                  key={index}
                  className={`relative p-8 bg-white rounded-2xl ${
                    plan.highlight
                      ? 'ring-4 ring-blue-600 shadow-2xl scale-105'
                      : 'shadow-sm border border-slate-100'
                  } transition-all duration-300 hover:shadow-xl`}
                >
                  {plan.highlight && billingCycle === 'annual' && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-semibold rounded-full">
                      🎉 Best Value
                    </div>
                  )}
                  
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  <p className="text-slate-600 mb-6">{plan.description}</p>
                  
                  <div className="mb-6">
                    {billingCycle === 'annual' && displayPrice > 0 ? (
                      <>
                        <div className="flex items-baseline">
                          <span className="text-4xl font-bold text-slate-900">£{(displayPrice * 12).toLocaleString()}</span>
                          <span className="text-slate-600 ml-2">/year</span>
                        </div>
                        <div className="mt-2">
                          <span className="text-sm text-slate-600">
                            £{displayPrice}/month <span className="text-green-600 font-semibold">(Save £{((plan.monthlyPrice - displayPrice) * 12).toLocaleString()})</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-slate-900">£{displayPrice}</span>
                        <span className="text-slate-600 ml-2">/month</span>
                      </div>
                    )}
                  </div>

                  <a
                    href="/signup"
                    className={`block w-full py-3 px-6 rounded-xl font-semibold text-center transition-all duration-300 ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {plan.cta}
                  </a>

                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-12 shadow-2xl">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Business?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join hundreds of contractor companies already saving time and money with CrewQuo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/signup"
                className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105"
              >
                Start Your Free Trial
              </a>
            </div>
            <p className="mt-6 text-sm text-blue-100">
              No credit card required • 7-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">CrewQuo</span>
              </div>
              <p className="text-sm text-slate-400">
                The ultimate contractor management platform for modern businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="/docs" className="hover:text-white transition">Documentation</a></li>
                <li><a href="/introduction" className="hover:text-white transition">Platform Guide</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="mailto:support@crewquo.com" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">GDPR</a></li>
                <li><a href="#" className="hover:text-white transition">Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-slate-400">
              © 2025 CrewQuo. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <span className="text-xs text-slate-500">🔥 Firebase</span>
              <span className="text-xs text-slate-500">⚡ Next.js 15</span>
              <span className="text-xs text-slate-500">🎨 Tailwind CSS</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
