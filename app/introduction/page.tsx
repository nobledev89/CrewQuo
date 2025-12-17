'use client';

import Link from 'next/link';
import { 
  ArrowRight, 
  Users, 
  Clock, 
  TrendingUp, 
  Shield, 
  Zap, 
  FileText, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  Layers,
  CheckCircle2,
  Settings,
  Bell,
  Download,
  Upload,
  Filter,
  Search,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  FolderPlus,
  PieChart,
  LineChart
} from 'lucide-react';
import { useState } from 'react';

export default function IntroductionPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const features = [
    {
      id: 'overview',
      title: 'Platform Overview',
      icon: Layers,
      color: 'from-blue-500 to-blue-600',
      sections: [
        {
          title: 'Your Command Center',
          description: 'CrewQuo provides a centralized dashboard where you can monitor all aspects of your contractor business in real-time.',
          features: [
            'Real-time project status updates',
            'Quick access to recent activities',
            'Key performance indicators at a glance',
            'Notifications and alerts',
            'Customizable dashboard widgets'
          ]
        },
        {
          title: 'Multi-Company Management',
          description: 'Seamlessly manage multiple companies or work as a subcontractor for different organizations.',
          features: [
            'Switch between companies instantly',
            'Separate data isolation per company',
            'Role-based access for each organization',
            'Consolidated reporting across companies'
          ]
        }
      ]
    },
    {
      id: 'clients',
      title: 'Client Management',
      icon: Users,
      color: 'from-indigo-500 to-indigo-600',
      sections: [
        {
          title: 'Client Database',
          description: 'Maintain a comprehensive database of all your clients with detailed profiles and contact information.',
          features: [
            'Add unlimited clients',
            'Store contact details and company information',
            'Track client-specific rates and terms',
            'View client history and project portfolio',
            'Quick search and filtering'
          ]
        },
        {
          title: 'Client Portal Access',
          description: 'Provide clients with secure access to view their projects, timesheets, and expenses.',
          features: [
            'Secure login for each client',
            'View-only access to relevant data',
            'Download reports and invoices',
            'Real-time project updates'
          ]
        }
      ]
    },
    {
      id: 'projects',
      title: 'Project Management',
      icon: FolderPlus,
      color: 'from-purple-500 to-purple-600',
      sections: [
        {
          title: 'Create & Organize Projects',
          description: 'Set up projects with detailed specifications, budgets, and timelines.',
          features: [
            'Project templates for quick setup',
            'Assign multiple subcontractors',
            'Set project budgets and deadlines',
            'Track project status and progress',
            'Attach documents and notes'
          ]
        },
        {
          title: 'Team Assignment',
          description: 'Efficiently allocate subcontractors to projects based on skills and availability.',
          features: [
            'View subcontractor availability',
            'Assign roles and responsibilities',
            'Set project-specific rates',
            'Track individual contributions',
            'Manage project access permissions'
          ]
        },
        {
          title: 'Project Analytics',
          description: 'Monitor project performance with detailed analytics and insights.',
          features: [
            'Cost vs. budget tracking',
            'Time spent analysis',
            'Profitability calculations',
            'Resource utilization reports',
            'Variance analysis'
          ]
        }
      ]
    },
    {
      id: 'subcontractors',
      title: 'Subcontractor Management',
      icon: UserPlus,
      color: 'from-pink-500 to-pink-600',
      sections: [
        {
          title: 'Subcontractor Profiles',
          description: 'Maintain detailed profiles for all your subcontractors with skills, rates, and availability.',
          features: [
            'Personal and contact information',
            'Skills and certifications',
            'Default rates and rate cards',
            'Availability calendar',
            'Performance history'
          ]
        },
        {
          title: 'Invite & Onboard',
          description: 'Easily invite subcontractors to join your platform and grant them appropriate access.',
          features: [
            'Send email invitations',
            'Automated onboarding workflow',
            'Role-based permissions',
            'Training materials and guides',
            'Document collection'
          ]
        },
        {
          title: 'Performance Tracking',
          description: 'Monitor subcontractor performance and productivity across all projects.',
          features: [
            'Hours worked tracking',
            'Project completion rates',
            'Quality ratings',
            'Billing accuracy',
            'Availability patterns'
          ]
        }
      ]
    },
    {
      id: 'timesheets',
      title: 'Time Tracking',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      sections: [
        {
          title: 'Shift-Based Time Logs',
          description: 'Advanced time tracking with shift-based logging and automatic calculations.',
          features: [
            'Clock in/out functionality',
            'Multiple shift types (day, night, weekend)',
            'Break time management',
            'Overtime tracking',
            'GPS location tracking (optional)'
          ]
        },
        {
          title: 'Approval Workflow',
          description: 'Streamlined approval process for all time entries with multi-level review.',
          features: [
            'Manager review and approval',
            'Client approval (optional)',
            'Batch approvals',
            'Rejection with comments',
            'Audit trail'
          ]
        },
        {
          title: 'Automatic Calculations',
          description: 'Smart rate resolution based on role, shift type, date, and client.',
          features: [
            'Dynamic rate card system',
            'Overtime multipliers',
            'Holiday rate adjustments',
            'Client-specific rates',
            'Cost vs. billing rate tracking'
          ]
        }
      ]
    },
    {
      id: 'ratecards',
      title: 'Rate Cards',
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
      sections: [
        {
          title: 'Complex Rate Structures',
          description: 'Define sophisticated rate cards with multiple variables and conditions.',
          features: [
            'Role-based rates',
            'Shift type variations',
            'Date-based effective rates',
            'Client-specific overrides',
            'Cost and billing rates'
          ]
        },
        {
          title: 'Rate Templates',
          description: 'Create reusable rate templates for common scenarios.',
          features: [
            'Standard rate templates',
            'Industry-specific presets',
            'Quick copy and modify',
            'Historical rate tracking',
            'Rate change audit log'
          ]
        },
        {
          title: 'Rate Resolution',
          description: 'Automatic rate selection based on multiple criteria.',
          features: [
            'Priority-based resolution',
            'Fallback rates',
            'Preview calculations',
            'Rate conflict warnings',
            'Manual override option'
          ]
        }
      ]
    },
    {
      id: 'expenses',
      title: 'Expense Management',
      icon: FileText,
      color: 'from-red-500 to-red-600',
      sections: [
        {
          title: 'Expense Tracking',
          description: 'Comprehensive expense management with receipt upload and categorization.',
          features: [
            'Mobile receipt capture',
            'Expense categorization',
            'Project allocation',
            'Mileage tracking',
            'Per diem management'
          ]
        },
        {
          title: 'Approval Process',
          description: 'Multi-stage approval workflow for expense claims.',
          features: [
            'Manager approval',
            'Budget verification',
            'Policy compliance checks',
            'Batch processing',
            'Automatic notifications'
          ]
        },
        {
          title: 'Reimbursement',
          description: 'Track and manage expense reimbursements efficiently.',
          features: [
            'Payment status tracking',
            'Integration with payroll',
            'Export to accounting systems',
            'Reimbursement reports',
            'Outstanding balance alerts'
          ]
        }
      ]
    },
    {
      id: 'reports',
      title: 'Reporting & Analytics',
      icon: BarChart3,
      color: 'from-teal-500 to-teal-600',
      sections: [
        {
          title: 'Financial Reports',
          description: 'Comprehensive financial reporting with real-time insights.',
          features: [
            'Profit & loss statements',
            'Revenue by project/client',
            'Cost analysis',
            'Margin calculations',
            'Cash flow projections'
          ]
        },
        {
          title: 'Operational Reports',
          description: 'Track operational metrics and KPIs.',
          features: [
            'Resource utilization',
            'Project completion rates',
            'Time tracking summaries',
            'Subcontractor productivity',
            'Client engagement metrics'
          ]
        },
        {
          title: 'Custom Reports',
          description: 'Build custom reports tailored to your specific needs.',
          features: [
            'Drag-and-drop report builder',
            'Custom filters and grouping',
            'Scheduled report delivery',
            'Export to Excel/PDF',
            'Visual dashboards'
          ]
        }
      ]
    },
    {
      id: 'settings',
      title: 'Settings & Customization',
      icon: Settings,
      color: 'from-gray-500 to-gray-600',
      sections: [
        {
          title: 'Company Settings',
          description: 'Configure your company profile and preferences.',
          features: [
            'Company information',
            'Logo and branding',
            'Business hours',
            'Currency and timezone',
            'Tax settings'
          ]
        },
        {
          title: 'User Management',
          description: 'Manage team members and their access levels.',
          features: [
            'Add/remove users',
            'Role assignment',
            'Permission management',
            'Activity monitoring',
            'SSO integration'
          ]
        },
        {
          title: 'Integrations',
          description: 'Connect with your favorite tools and services.',
          features: [
            'Accounting software sync',
            'Calendar integration',
            'Email notifications',
            'API access',
            'Webhook support'
          ]
        }
      ]
    }
  ];

  const activeFeature = features.find(f => f.id === activeTab) || features[0];

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
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">
            Complete Platform Guide
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Discover everything you can do with CrewQuo. From managing clients and projects 
            to tracking time and generating reports—we've got you covered.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
              <span>Complete Feature Tour</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
              <span>Step-by-Step Guides</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
              <span>Best Practices</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 px-3">Features</h3>
                <nav className="space-y-1">
                  {features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <button
                        key={feature.id}
                        onClick={() => setActiveTab(feature.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                          activeTab === feature.id
                            ? 'bg-gradient-to-r ' + feature.color + ' text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{feature.title}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className="space-y-8">
                {/* Feature Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <div className="flex items-start space-x-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${activeFeature.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                      <activeFeature.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        {activeFeature.title}
                      </h2>
                      <p className="text-lg text-slate-600">
                        Comprehensive tools to manage every aspect of your business
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature Sections */}
                {activeFeature.sections.map((section, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 hover:shadow-md transition-shadow duration-300"
                  >
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">
                      {section.title}
                    </h3>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                      {section.description}
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {section.features.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-start space-x-3 group">
                          <div className={`w-6 h-6 bg-gradient-to-br ${activeFeature.color} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform`}>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-slate-700 leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Quick Tips */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-8">
                  <div className="flex items-start space-x-3">
                    <Zap className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="text-lg font-bold text-amber-900 mb-2">Pro Tip</h4>
                      <p className="text-amber-800">
                        Start with the basics and gradually explore advanced features as your team gets comfortable. 
                        Our onboarding guide will help you get set up in under 10 minutes!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Start your free trial today and experience the full power of CrewQuo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 inline-flex items-center justify-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/"
              className="px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold border-2 border-slate-300 hover:border-slate-400 transition-all duration-300 inline-flex items-center justify-center"
            >
              Back to Home
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            No credit card required • 7-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm">
            © 2025 CrewQuo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
