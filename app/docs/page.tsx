'use client';

import Link from 'next/link';
import { 
  ArrowRight, 
  Layers,
  CheckCircle2,
  Search,
  HelpCircle,
  BookOpen,
  FileText,
  Users,
  Clock,
  DollarSign,
  Shield,
  Settings,
  MessageCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Download,
  Upload,
  Edit3,
  Trash2,
  Copy,
  AlertCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useState } from 'react';

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<'faqs' | 'tutorials' | 'howto'>('faqs');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedTutorial, setExpandedTutorial] = useState<number | null>(0);

  const faqs = [
    {
      category: 'Getting Started',
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      questions: [
        {
          q: 'How do I sign up for CrewQuo?',
          a: 'Click the "Start Free Trial" button on our homepage, fill in your company details, and verify your email address. You\'ll get instant access to a 7-day free trial with no credit card required.'
        },
        {
          q: 'What happens after my free trial ends?',
          a: 'After your 7-day trial, you can choose a plan that fits your needs. Your data will be preserved, and you can continue using CrewQuo seamlessly. If you don\'t upgrade, your account will be paused, but your data remains secure for 30 days.'
        },
        {
          q: 'Can I import my existing data?',
          a: 'Yes! We support importing clients, subcontractors, and projects from CSV files. Navigate to Settings > Import Data and follow the template provided. Our support team can help with bulk imports for large datasets.'
        },
        {
          q: 'How long does it take to set up?',
          a: 'Most companies are up and running in under 10 minutes! The basic setup involves adding your company info, inviting team members, and creating your first project. Our onboarding wizard guides you through each step.'
        },
        {
          q: 'Do I need technical knowledge to use CrewQuo?',
          a: 'Not at all! CrewQuo is designed to be user-friendly and intuitive. If you can use email and spreadsheets, you can use CrewQuo. We also provide comprehensive tutorials and responsive support.'
        }
      ]
    },
    {
      category: 'Account & Billing',
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'We accept all major credit cards (Visa, Mastercard, American Express) and support both monthly and annual billing. Annual plans save you 15%.'
        },
        {
          q: 'Can I change my plan later?',
          a: 'Absolutely! You can upgrade or downgrade your plan at any time. Upgrades take effect immediately, while downgrades apply at the next billing cycle. We\'ll prorate any differences.'
        },
        {
          q: 'What if I exceed my plan limits?',
          a: 'We\'ll notify you when you\'re approaching your limits. You can either upgrade to a higher plan or purchase additional capacity as needed. We never suddenly cut off access to your account.'
        },
        {
          q: 'Is there a refund policy?',
          a: 'Yes! We offer a 30-day money-back guarantee on annual plans. If you\'re not satisfied within the first 30 days, we\'ll refund your payment in full, no questions asked.'
        },
        {
          q: 'Can I cancel anytime?',
          a: 'Yes, you can cancel your subscription at any time from your account settings. You\'ll retain access until the end of your billing period, and you can export all your data before leaving.'
        }
      ]
    },
    {
      category: 'Users & Permissions',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      questions: [
        {
          q: 'What are the different user roles?',
          a: 'CrewQuo has three main roles: Admin (full access), Manager (can manage projects and approve timesheets), and Subcontractor (can log time and expenses for assigned projects). Each role has specific permissions.'
        },
        {
          q: 'How do I invite team members?',
          a: 'Go to Settings > Team Members and click "Invite User." Enter their email, select their role, and they\'ll receive an invitation to join your company workspace.'
        },
        {
          q: 'Can subcontractors access all projects?',
          a: 'No. Subcontractors only see projects they\'re assigned to. This ensures data privacy and keeps their workspace focused on relevant work.'
        },
        {
          q: 'How do I remove a user?',
          a: 'Admins can deactivate users from Settings > Team Members. Deactivated users lose access immediately but their historical data is preserved for reporting purposes.'
        },
        {
          q: 'Can I customize permissions?',
          a: 'Currently, we offer preset roles optimized for contractor management. Custom permissions are coming soon! Contact us if you have specific requirements.'
        }
      ]
    },
    {
      category: 'Time Tracking',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      questions: [
        {
          q: 'How does shift-based tracking work?',
          a: 'Subcontractors log time by selecting a project, date, shift type (day/night/weekend), and hours worked. The system automatically calculates costs and billing based on your rate cards.'
        },
        {
          q: 'Can I track breaks?',
          a: 'Yes! When logging time, you can specify break duration. Breaks are automatically deducted from billable hours according to your settings.'
        },
        {
          q: 'What if I forget to log time?',
          a: 'No problem! You can add historical time entries for any past date. Managers and admins can also add or edit time entries on behalf of team members.'
        },
        {
          q: 'How do approvals work?',
          a: 'Time entries require manager approval before being finalized. Managers review submissions, can request changes or reject entries, and approve in bulk. Approved entries are locked to maintain audit integrity.'
        },
        {
          q: 'Can I track time on mobile?',
          a: 'Yes! CrewQuo is fully responsive and works on all devices. Simply access your account through your mobile browser to log time from anywhere.'
        }
      ]
    },
    {
      category: 'Rate Cards & Billing',
      icon: FileText,
      color: 'from-pink-500 to-pink-600',
      questions: [
        {
          q: 'How do rate cards work?',
          a: 'Rate cards define how much you pay subcontractors (cost rate) and charge clients (billing rate) based on role, shift type, and date. The system automatically selects the correct rate when calculating timesheets.'
        },
        {
          q: 'Can I have different rates for different clients?',
          a: 'Absolutely! You can create client-specific rate cards that override default rates. This is perfect for negotiated contract rates.'
        },
        {
          q: 'How do I handle rate changes?',
          a: 'Create a new rate card with a future effective date. The system will automatically apply the new rate from that date forward, while preserving historical rates for past entries.'
        },
        {
          q: 'What are rate templates?',
          a: 'Rate templates are reusable rate structures you can quickly apply to new projects or clients. They save time when you have standard rate structures across multiple engagements.'
        },
        {
          q: 'Can I add markups or margins?',
          a: 'Yes! Set different cost rates (what you pay) and billing rates (what you charge). CrewQuo automatically calculates margins and shows profitability in real-time.'
        }
      ]
    },
    {
      category: 'Security & Privacy',
      icon: Shield,
      color: 'from-red-500 to-red-600',
      questions: [
        {
          q: 'Is my data secure?',
          a: 'Yes! We use bank-level encryption (256-bit SSL), store data in Google Cloud\'s secure infrastructure, and implement multi-tenant isolation. Each company\'s data is completely separate.'
        },
        {
          q: 'Where is my data stored?',
          a: 'All data is stored in Google Cloud Firebase (Firestore) with automatic backups and redundancy. You can choose your data region during setup to comply with local regulations.'
        },
        {
          q: 'Are you GDPR compliant?',
          a: 'Yes! CrewQuo is fully GDPR compliant. We provide data processing agreements, support data export/deletion requests, and implement privacy by design principles.'
        },
        {
          q: 'Can I export my data?',
          a: 'Absolutely! You can export all your data at any time in CSV or JSON format. Go to Settings > Export Data to download clients, projects, timesheets, expenses, and reports.'
        },
        {
          q: 'What happens if I delete my account?',
          a: 'When you delete your account, all data is permanently removed within 30 days (unless required by law to retain). You can export everything before deletion.'
        }
      ]
    },
    {
      category: 'Support & Help',
      icon: MessageCircle,
      color: 'from-teal-500 to-teal-600',
      questions: [
        {
          q: 'How can I get support?',
          a: 'We offer email support at support@crewquo.com with response times of 1-3 hours (Business Pro), 1-3 days (Business Starter), or 1-3 days (Personal). We also have live chat for urgent issues.'
        },
        {
          q: 'Do you offer training?',
          a: 'Yes! We provide video tutorials, written guides, and webinars. Business Pro plans include personalized onboarding calls. Check our tutorials section for detailed training materials.'
        },
        {
          q: 'Can you help migrate from my current system?',
          a: 'Absolutely! Our team can help migrate data from spreadsheets or other systems. Business Pro customers receive white-glove migration assistance.'
        },
        {
          q: 'What if I have a feature request?',
          a: 'We love feedback! Email your suggestions to feedback@crewquo.com or use the feedback widget in your dashboard. We regularly review and prioritize user requests.'
        },
        {
          q: 'Are there video tutorials?',
          a: 'Yes! Check our Tutorials section on this page and our YouTube channel for step-by-step video guides covering all major features.'
        }
      ]
    }
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      faq =>
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                CrewQuo
              </span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-full mb-6">
            <HelpCircle className="w-5 h-5 mr-2" />
            <span className="text-sm font-semibold">Help Center</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">
            How Can We Help You?
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Find answers to common questions, learn how to use CrewQuo, and discover best practices for managing your contractor business.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl text-slate-900 text-lg focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-xl"
            />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
            <span className="text-blue-100">Popular:</span>
            <button
              onClick={() => setSearchQuery('sign up')}
              className="px-4 py-1 bg-white/20 rounded-full hover:bg-white/30 transition"
            >
              Getting Started
            </button>
            <button
              onClick={() => setSearchQuery('rate cards')}
              className="px-4 py-1 bg-white/20 rounded-full hover:bg-white/30 transition"
            >
              Rate Cards
            </button>
            <button
              onClick={() => setSearchQuery('time tracking')}
              className="px-4 py-1 bg-white/20 rounded-full hover:bg-white/30 transition"
            >
              Time Tracking
            </button>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="bg-white border-b border-slate-200 sticky top-[88px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('faqs')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'faqs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-5 h-5" />
              <span>FAQs</span>
            </button>
            <button
              onClick={() => setActiveTab('tutorials')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'tutorials'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span>Tutorials</span>
            </button>
            <button
              onClick={() => setActiveTab('howto')}
              className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'howto'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>How-To Guides</span>
            </button>
          </nav>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* FAQs Tab */}
          {activeTab === 'faqs' && (
            <div className="space-y-8">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                  Frequently Asked Questions
                </h2>
                <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                  Quick answers to questions you may have. Can't find what you're looking for? 
                  <a href="mailto:support@crewquo.com" className="text-blue-600 hover:text-blue-700 ml-1">
                    Contact our support team
                  </a>
                </p>
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No results found</h3>
                  <p className="text-slate-600">
                    Try a different search term or browse all categories below
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredFaqs.map((category, categoryIndex) => {
                    const Icon = category.icon;
                    return (
                      <div key={categoryIndex} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className={`bg-gradient-to-r ${category.color} px-6 py-4 flex items-center space-x-3`}>
                          <Icon className="w-6 h-6 text-white" />
                          <h3 className="text-2xl font-bold text-white">{category.category}</h3>
                        </div>
                        <div className="divide-y divide-slate-200">
                          {category.questions.map((faq, faqIndex) => {
                            const globalIndex = categoryIndex * 100 + faqIndex;
                            const isExpanded = expandedFaq === globalIndex;
                            return (
                              <div key={faqIndex} className="p-6">
                                <button
                                  onClick={() => toggleFaq(globalIndex)}
                                  className="w-full flex items-start justify-between text-left group"
                                >
                                  <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                                      {faq.q}
                                    </h4>
                                  </div>
                                  <div className="flex-shrink-0 ml-4">
                                    {isExpanded ? (
                                      <ChevronUp className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                    )}
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="mt-4 text-slate-600 leading-relaxed pl-0 animate-fadeIn">
                                    {faq.a}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tutorials Tab */}
          {activeTab === 'tutorials' && (
            <div className="space-y-8">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                  Step-by-Step Tutorials
                </h2>
                <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                  Follow these comprehensive guides to master CrewQuo. Each tutorial walks you through essential tasks from start to finish.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-12">
                {[
                  { icon: Users, title: 'Getting Started', count: '5 min', color: 'from-blue-500 to-blue-600' },
                  { icon: FolderPlus, title: 'Project Management', count: '8 min', color: 'from-purple-500 to-purple-600' },
                  { icon: Clock, title: 'Time Tracking', count: '6 min', color: 'from-orange-500 to-orange-600' },
                  { icon: DollarSign, title: 'Rate Cards Setup', count: '7 min', color: 'from-green-500 to-green-600' },
                ].map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => setExpandedTutorial(index)}
                      className={`p-6 rounded-xl border-2 transition-all duration-300 text-left ${
                        expandedTutorial === index
                          ? 'border-blue-600 bg-blue-50 shadow-lg'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">{card.title}</h3>
                            <p className="text-sm text-slate-600">{card.count} read</p>
                          </div>
                        </div>
                        <CheckCircle2 className={`w-6 h-6 flex-shrink-0 ${expandedTutorial === index ? 'text-blue-600' : 'text-slate-300'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Tutorial 1: Getting Started */}
              {expandedTutorial === 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fadeIn">
                  <div className="flex items-start space-x-4 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">Getting Started with CrewQuo</h3>
                      <p className="text-lg text-slate-600">Set up your account and get ready to manage your contractor business</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {[
                      {
                        step: 1,
                        title: 'Create Your Account',
                        description: 'Start your 7-day free trial by signing up with your email address.',
                        details: [
                          'Click "Start Free Trial" on the homepage',
                          'Enter your company name, your name, and email address',
                          'Create a secure password (min. 8 characters)',
                          'Check your email and verify your account',
                          'You\'ll be automatically logged in to your new dashboard'
                        ]
                      },
                      {
                        step: 2,
                        title: 'Complete Company Profile',
                        description: 'Add essential information about your business.',
                        details: [
                          'Navigate to Settings > Company Profile',
                          'Add your company logo (recommended: 200x200px)',
                          'Enter business details: address, phone, website',
                          'Set your currency and timezone preferences',
                          'Configure tax settings if applicable',
                          'Click "Save Changes"'
                        ]
                      },
                      {
                        step: 3,
                        title: 'Invite Your Team',
                        description: 'Add managers and administrators to help run your business.',
                        details: [
                          'Go to Settings > Team Members',
                          'Click "Invite User" button',
                          'Enter team member\'s email address',
                          'Select their role: Admin or Manager',
                          'Add a personal message (optional)',
                          'Click "Send Invitation"',
                          'They\'ll receive an email to join your workspace'
                        ]
                      },
                      {
                        step: 4,
                        title: 'Add Your First Client',
                        description: 'Create a client profile to start managing projects.',
                        details: [
                          'Navigate to Dashboard > Clients',
                          'Click "Add Client" button',
                          'Enter client details: name, contact person, email',
                          'Add company address and phone number',
                          'Set client status to "Active"',
                          'Click "Create Client"'
                        ]
                      },
                      {
                        step: 5,
                        title: 'Explore the Dashboard',
                        description: 'Familiarize yourself with the main navigation and features.',
                        details: [
                          'Review the dashboard overview for key metrics',
                          'Explore the sidebar: Clients, Projects, Subcontractors, etc.',
                          'Check the notifications bell for updates',
                          'Access your profile menu (top right)',
                          'Try the search function to quickly find items',
                          'You\'re now ready to create your first project!'
                        ]
                      }
                    ].map((item, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          {item.step}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h4>
                          <p className="text-slate-600 mb-4">{item.description}</p>
                          <ul className="space-y-2">
                            {item.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start space-x-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-start space-x-3">
                      <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-lg font-bold text-blue-900 mb-2">Next Steps</h4>
                        <p className="text-blue-800">
                          Now that you're set up, continue to the Project Management tutorial to learn how to create and manage your first project!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tutorial 2: Project Management */}
              {expandedTutorial === 1 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fadeIn">
                  <div className="flex items-start space-x-4 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <FolderPlus className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">Project Management</h3>
                      <p className="text-lg text-slate-600">Create projects and assign subcontractors to get work done</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {[
                      {
                        step: 1,
                        title: 'Create a New Project',
                        description: 'Set up a project with budget, timeline, and details.',
                        details: [
                          'Navigate to Dashboard > Projects',
                          'Click "Add Project" button',
                          'Enter project name and description',
                          'Select the client from the dropdown',
                          'Set project start and end dates',
                          'Enter budget amount (optional)',
                          'Choose project status: Active, Planned, or Completed',
                          'Add any notes or special requirements',
                          'Click "Create Project"'
                        ]
                      },
                      {
                        step: 2,
                        title: 'Add Subcontractors',
                        description: 'Invite subcontractors to join your platform.',
                        details: [
                          'Go to Dashboard > Subcontractors',
                          'Click "Invite Subcontractor" button',
                          'Enter their name and email address',
                          'Add contact details and skills',
                          'Set their default role (e.g., Developer, Designer)',
                          'Click "Send Invitation"',
                          'They\'ll receive an email to create their account',
                          'Once accepted, they\'ll appear in your subcontractors list'
                        ]
                      },
                      {
                        step: 3,
                        title: 'Assign Subcontractors to Project',
                        description: 'Add team members to your project with specific roles.',
                        details: [
                          'Open the project details page',
                          'Scroll to "Team Members" section',
                          'Click "Assign Subcontractor"',
                          'Select subcontractor from the list',
                          'Choose their role on this project',
                          'Set project-specific rate card (if different from default)',
                          'Add assignment notes if needed',
                          'Click "Assign"',
                          'Subcontractor will be notified and can now log time'
                        ]
                      },
                      {
                        step: 4,
                        title: 'Set Up Project Rate Cards',
                        description: 'Define how much you\'ll pay and charge for work on this project.',
                        details: [
                          'In project details, go to "Rate Cards" tab',
                          'Click "Add Rate Card"',
                          'Select the role (matches subcontractor assignments)',
                          'Choose shift types: Day, Night, Weekend, Holiday',
                          'Enter cost rate (what you pay the subcontractor)',
                          'Enter billing rate (what you charge the client)',
                          'Set effective date for this rate',
                          'Click "Save Rate Card"',
                          'Rates will auto-apply when time is logged'
                        ]
                      },
                      {
                        step: 5,
                        title: 'Monitor Project Progress',
                        description: 'Track time, costs, and profitability in real-time.',
                        details: [
                          'View project dashboard for key metrics',
                          'Check "Hours Logged" vs. budget',
                          'Review "Cost vs. Billing" to see margins',
                          'Monitor "Project Status" and completion percentage',
                          'View recent time entries and pending approvals',
                          'Generate project reports for detailed analysis',
                          'Update project status as work progresses'
                        ]
                      }
                    ].map((item, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {item.step}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h4>
                          <p className="text-slate-600 mb-4">{item.description}</p>
                          <ul className="space-y-2">
                            {item.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start space-x-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <div className="flex items-start space-x-3">
                      <CheckCircle2 className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-lg font-bold text-purple-900 mb-2">Pro Tip</h4>
                        <p className="text-purple-800">
                          Set realistic budgets and timelines from the start. You can always adjust them, but having clear targets helps keep projects on track and profitable.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tutorial 3: Time Tracking */}
              {expandedTutorial === 2 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fadeIn">
                  <div className="flex items-start space-x-4 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Clock className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">Time Tracking & Approvals</h3>
                      <p className="text-lg text-slate-600">Log work hours and manage approval workflows</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {[
                      {
                        step: 1,
                        title: 'Log Time as a Subcontractor',
                        description: 'Record your work hours for accurate billing.',
                        details: [
                          'Navigate to Dashboard > Timesheets (or My Work > Timesheets)',
                          'Click "Log Time" button',
                          'Select the project you worked on',
                          'Choose the date of work',
                          'Select shift type: Day, Night, Weekend, or Holiday',
                          'Enter hours worked (e.g., 8.5 for 8 hours 30 minutes)',
                          'Add break time if applicable',
                          'Include a description of work performed',
                          'Click "Submit for Approval"'
                        ]
                      },
                      {
                        step: 2,
                        title: 'Review Pending Time Entries',
                        description: 'Managers review and approve submitted hours.',
                        details: [
                          'Go to Dashboard > Timesheets',
                          'Filter by "Pending Approval" status',
                          'Review subcontractor name, project, and hours',
                          'Check the shift type and dates',
                          'Verify the work description',
                          'Review auto-calculated costs and billing amounts',
                          'Click on an entry to view full details',
                          'Ensure accuracy before approving'
                        ]
                      },
                      {
                        step: 3,
                        title: 'Approve or Reject Entries',
                        description: 'Take action on submitted time logs.',
                        details: [
                          'Select one or more pending entries',
                          'To approve: Click "Approve Selected" button',
                          'To reject: Click "Reject" and add a reason',
                          'For batch approval: Select multiple and approve all',
                          'Approved entries are locked and cannot be edited',
                          'Rejected entries return to subcontractor for revision',
                          'Subcontractors receive email notifications',
                          'Approved hours appear in reports and invoices'
                        ]
                      },
                      {
                        step: 4,
                        title: 'Edit Time Entries (Before Approval)',
                        description: 'Make corrections to time logs as needed.',
                        details: [
                          'Find the time entry in the timesheets list',
                          'Click the "Edit" icon (only for pending entries)',
                          'Update hours, date, or shift type',
                          'Modify the work description',
                          'Change the project if logged incorrectly',
                          'Click "Update" to save changes',
                          'Re-submit for approval if required',
                          'Note: Approved entries cannot be edited'
                        ]
                      },
                      {
                        step: 5,
                        title: 'Generate Timesheet Reports',
                        description: 'Create reports for payroll and client billing.',
                        details: [
                          'Navigate to Dashboard > Reports',
                          'Select "Timesheet Report" type',
                          'Choose date range (week, month, or custom)',
                          'Filter by project, client, or subcontractor',
                          'Select "Approved Only" for final reports',
                          'Click "Generate Report"',
                          'Review totals: hours, costs, billing',
                          'Export to PDF or Excel',
                          'Use for invoicing and payroll processing'
                        ]
                      }
                    ].map((item, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                          {item.step}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h4>
                          <p className="text-slate-600 mb-4">{item.description}</p>
                          <ul className="space-y-2">
                            {item.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start space-x-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
                    <div className="flex items-start space-x-3">
                      <CheckCircle2 className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-lg font-bold text-orange-900 mb-2">Best Practice</h4>
                        <p className="text-orange-800">
                          Approve timesheets weekly to maintain cash flow and keep accurate records. Set reminders for your team to submit hours by Friday each week.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tutorial 4: Rate Cards */}
              {expandedTutorial === 3 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fadeIn">
                  <div className="flex items-start space-x-4 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">Rate Cards Setup</h3>
                      <p className="text-lg text-slate-600">Master complex billing rates and maximize profitability</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {[
                      {
                        step: 1,
                        title: 'Understand Rate Card Basics',
                        description: 'Learn how CrewQuo calculates costs and billing.',
                        details: [
                          'Cost Rate: What you pay the subcontractor',
                          'Billing Rate: What you charge the client',
                          'Margin: Billing Rate minus Cost Rate',
                          'Shift Type: Day, Night, Weekend, Holiday (different rates)',
                          'Role-based: Different rates for different job roles',
                          'Date-based: Rates can change over time',
                          'Client-specific: Override rates for specific clients',
                          'Automatic calculation: System picks the right rate'
                        ]
                      },
                      {
                        step: 2,
                        title: 'Create a Default Rate Card',
                        description: 'Set up standard rates for your subcontractors.',
                        details: [
                          'Go to Dashboard > Rate Cards',
                          'Click "Create Rate Card"',
                          'Enter a descriptive name (e.g., "Developer Standard Rates")',
                          'Select the role this applies to',
                          'Choose shift type (start with "Day")',
                          'Set cost rate per hour (e.g., £25/hr)',
                          'Set billing rate per hour (e.g., £40/hr)',
                          'Select effective date (today\'s date)',
                          'Leave client field empty for default rate',
                          'Click "Save Rate Card"',
                          'Repeat for Night, Weekend, and Holiday shifts'
                        ]
                      },
                      {
                        step: 3,
                        title: 'Create Client-Specific Rates',
                        description: 'Override default rates for specific client contracts.',
                        details: [
                          'Navigate to Dashboard > Rate Cards',
                          'Click "Create Rate Card"',
                          'Name it clearly (e.g., "Client X - Developer Rates")',
                          'Select the role',
                          'Choose shift type',
                          'Enter cost rate (may differ from default)',
                          'Enter billing rate (per client contract)',
                          'Set effective date',
                          'Select the specific client from dropdown',
                          'Click "Save Rate Card"',
                          'This rate will override default when logging time for this client'
                        ]
                      },
                      {
                        step: 4,
                        title: 'Use Rate Templates',
                        description: 'Create reusable rate structures for faster setup.',
                        details: [
                          'Go to Dashboard > Rate Templates',
                          'Click "Create Template"',
                          'Name your template (e.g., "Standard Tech Rates")',
                          'Add multiple role/shift combinations',
                          'Set cost and billing rates for each',
                          'Save the template',
                          'When creating new rate cards: Select "Use Template"',
                          'Choose your template',
                          'Rates are pre-filled, adjust if needed',
                          'Save time on repetitive rate setups'
                        ]
                      },
                      {
                        step: 5,
                        title: 'Handle Rate Changes',
                        description: 'Update rates while preserving historical data.',
                        details: [
                          'Never edit existing rate cards directly',
                          'Instead, create a new rate card with future date',
                          'Example: Old rate valid until Dec 31, new rate from Jan 1',
                          'System automatically uses correct rate based on work date',
                          'Historical time entries keep their original rates',
                          'Future entries use new rates',
                          'This maintains accurate financial records',
                          'Great for annual rate increases or contract renewals'
                        ]
                      }
                    ].map((item, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                          {item.step}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h4>
                          <p className="text-slate-600 mb-4">{item.description}</p>
                          <ul className="space-y-2">
                            {item.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start space-x-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="flex items-start space-x-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-lg font-bold text-green-900 mb-2">Rate Card Strategy</h4>
                        <p className="text-green-800">
                          Start simple with basic day rates, then add complexity as needed. Aim for 30-40% margins on billing vs. cost rates to cover overhead and profit.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* How-To Guides Tab */}
          {activeTab === 'howto' && (
            <div className="space-y-8">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                  Quick How-To Guides
                </h2>
                <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                  Practical guides for specific tasks. Get answers fast with these focused, action-oriented instructions.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    icon: CheckCircle2,
                    title: 'Bulk Approve Timesheets',
                    description: 'Approve multiple time entries at once',
                    color: 'from-green-500 to-green-600',
                    steps: [
                      'Navigate to Dashboard > Timesheets',
                      'Filter by "Pending Approval" status',
                      'Select the checkbox next to each entry to approve',
                      'Or click the header checkbox to select all visible entries',
                      'Click "Approve Selected" button at the top',
                      'Confirm the bulk approval',
                      'All selected entries will be approved instantly'
                    ]
                  },
                  {
                    icon: Download,
                    title: 'Export Data for Accounting',
                    description: 'Download data for your accounting system',
                    color: 'from-blue-500 to-blue-600',
                    steps: [
                      'Go to Dashboard > Reports',
                      'Select report type (Timesheets, Expenses, etc.)',
                      'Set the date range you need',
                      'Apply any necessary filters (client, project, etc.)',
                      'Click "Generate Report"',
                      'Choose export format: Excel (.xlsx) or CSV',
                      'Click "Export" to download the file',
                      'Import the file into your accounting software'
                    ]
                  },
                  {
                    icon: DollarSign,
                    title: 'Handle Rate Disputes',
                    description: 'Resolve incorrect rate calculations',
                    color: 'from-orange-500 to-orange-600',
                    steps: [
                      'Find the disputed time entry in Timesheets',
                      'Click on the entry to view full details',
                      'Check the "Rate Applied" section',
                      'Verify the rate card that was used',
                      'If incorrect, reject the entry with explanation',
                      'Update the rate card if needed',
                      'Ask subcontractor to resubmit',
                      'Or manually adjust and approve with notes'
                    ]
                  },
                  {
                    icon: Copy,
                    title: 'Duplicate a Project',
                    description: 'Quickly create similar projects',
                    color: 'from-purple-500 to-purple-600',
                    steps: [
                      'Go to Dashboard > Projects',
                      'Find the project you want to duplicate',
                      'Click the three-dot menu (⋮) on the project card',
                      'Select "Duplicate Project"',
                      'Update the project name and dates',
                      'Review and adjust budget if needed',
                      'Team assignments and rate cards are copied',
                      'Click "Create Project" to finish'
                    ]
                  },
                  {
                    icon: Upload,
                    title: 'Import Bulk Data',
                    description: 'Upload multiple records via CSV',
                    color: 'from-indigo-500 to-indigo-600',
                    steps: [
                      'Navigate to Settings > Import Data',
                      'Download the CSV template for your data type',
                      'Fill in your data following the template format',
                      'Save as .csv file',
                      'Click "Choose File" and select your CSV',
                      'Review the preview of data to import',
                      'Click "Import" to process',
                      'Check for any errors and fix if needed'
                    ]
                  },
                  {
                    icon: Edit3,
                    title: 'Edit Approved Timesheets',
                    description: 'Make corrections to locked entries',
                    color: 'from-red-500 to-red-600',
                    steps: [
                      'Approved entries are locked for audit purposes',
                      'To edit: Go to Dashboard > Logs',
                      'Find the entry in audit log',
                      'Click "Request Amendment"',
                      'Explain the reason for the change',
                      'Admin must approve the unlock request',
                      'Once unlocked, edit and resubmit',
                      'Entry goes through approval again'
                    ]
                  },
                  {
                    icon: Trash2,
                    title: 'Archive Completed Projects',
                    description: 'Clean up your project list',
                    color: 'from-slate-500 to-slate-600',
                    steps: [
                      'Go to Dashboard > Projects',
                      'Find the completed project',
                      'Click on the project to open details',
                      'Change status to "Completed"',
                      'Review final numbers and generate final report',
                      'Click the archive icon (📦)',
                      'Confirm archiving',
                      'Archived projects move to "Archived" filter'
                    ]
                  },
                  {
                    icon: TrendingUp,
                    title: 'Track Project Profitability',
                    description: 'Monitor margins in real-time',
                    color: 'from-teal-500 to-teal-600',
                    steps: [
                      'Open the project details page',
                      'View the "Financial Overview" section',
                      'Check "Total Cost" (what you pay subcontractors)',
                      'Check "Total Billing" (what you charge client)',
                      'Margin % is calculated automatically',
                      'Review the "Budget vs. Actual" chart',
                      'Click "Generate Profitability Report" for details',
                      'Export to share with stakeholders'
                    ]
                  },
                  {
                    icon: RefreshCw,
                    title: 'Sync Rate Card Changes',
                    description: 'Update rates across projects',
                    color: 'from-pink-500 to-pink-600',
                    steps: [
                      'Create new rate card with updated rates',
                      'Set effective date for when new rates apply',
                      'Go to Dashboard > Projects',
                      'For each affected project, open details',
                      'Navigate to "Rate Cards" tab',
                      'The new rate will auto-apply for future entries',
                      'Past entries keep original rates',
                      'No manual updates needed!'
                    ]
                  },
                  {
                    icon: Users,
                    title: 'Add Multiple Subcontractors',
                    description: 'Invite your team quickly',
                    color: 'from-amber-500 to-amber-600',
                    steps: [
                      'Go to Dashboard > Subcontractors',
                      'Click "Bulk Invite" button',
                      'Download the CSV template',
                      'Fill in: Name, Email, Role, Default Rate',
                      'Upload the completed CSV',
                      'Review the preview',
                      'Click "Send Invitations"',
                      'All subcontractors receive email invites simultaneously'
                    ]
                  },
                  {
                    icon: AlertCircle,
                    title: 'Set Up Notifications',
                    description: 'Configure email alerts',
                    color: 'from-yellow-500 to-yellow-600',
                    steps: [
                      'Navigate to Settings > Notifications',
                      'Choose notification types to enable',
                      'Options: Time entries, Approvals, Budget alerts, etc.',
                      'Set frequency: Instant, Daily digest, Weekly',
                      'Add email addresses for team notifications',
                      'Configure threshold alerts (e.g., 80% budget)',
                      'Enable mobile notifications if needed',
                      'Save your preferences'
                    ]
                  },
                  {
                    icon: Shield,
                    title: 'Manage User Permissions',
                    description: 'Control who can access what',
                    color: 'from-gray-500 to-gray-600',
                    steps: [
                      'Go to Settings > Team Members',
                      'Click on a user to edit their access',
                      'Select their role: Admin, Manager, or Subcontractor',
                      'Admins: Full access to everything',
                      'Managers: Can manage projects and approve entries',
                      'Subcontractors: Can only log time for assigned projects',
                      'Click "Update Permissions"',
                      'User access updates immediately'
                    ]
                  }
                ].map((guide, index) => {
                  const Icon = guide.icon;
                  return (
                    <div
                      key={index}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className={`w-12 h-12 bg-gradient-to-br ${guide.color} rounded-xl flex items-center justify-center mb-4`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        {guide.title}
                      </h3>
                      <p className="text-slate-600 mb-4 text-sm">
                        {guide.description}
                      </p>
                      <div className="space-y-2">
                        {guide.steps.map((step, stepIndex) => (
                          <div key={stepIndex} className="flex items-start space-x-2">
                            <span className="flex-shrink-0 w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 mt-0.5">
                              {stepIndex + 1}
                            </span>
                            <span className="text-sm text-slate-700 leading-relaxed">
                              {step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Tips Section */}
              <div className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">Pro Tips for Power Users</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">Keyboard Shortcuts</p>
                          <p className="text-sm text-slate-700">Use Ctrl/Cmd + K to open quick search anywhere</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">Saved Filters</p>
                          <p className="text-sm text-slate-700">Save frequently-used filters for one-click access</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">Batch Operations</p>
                          <p className="text-sm text-slate-700">Hold Shift to select ranges of items for bulk actions</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">Custom Reports</p>
                          <p className="text-sm text-slate-700">Schedule reports to email automatically weekly/monthly</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">Mobile App</p>
                          <p className="text-sm text-slate-700">Add CrewQuo to your home screen for app-like experience</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-900">Data Backup</p>
                          <p className="text-sm text-slate-700">Export your data monthly as a backup best practice</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Contact Support CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-12 text-center text-white shadow-2xl">
            <Mail className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Still Have Questions?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Our support team is here to help you succeed. Get in touch and we'll respond quickly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@crewquo.com"
                className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 inline-flex items-center justify-center"
              >
                <Mail className="w-5 h-5 mr-2" />
                Email Support
              </a>
              <Link
                href="/introduction"
                className="px-8 py-4 bg-blue-700 text-white rounded-xl font-semibold hover:bg-blue-800 transition-all duration-300 inline-flex items-center justify-center"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Platform Guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">CrewQuo</span>
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/" className="hover:text-white transition">Home</Link>
              <Link href="/introduction" className="hover:text-white transition">Platform Guide</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <a href="mailto:support@crewquo.com" className="hover:text-white transition">Contact</a>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm text-slate-400">
            © 2025 CrewQuo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
