# CrewQuo

**Subcontractor Management Platform**

CrewQuo is an all-in-one platform that streamlines project management, time tracking, and billing for contractor companies. Save time, reduce errors, and maximize profits.

🌐 **Live App:** https://crewquo.com

---

## Features

### 👥 Multi-Company Support
- Work for multiple companies within a single account
- Switch between companies seamlessly
- Maintain separate billing and rate cards per company

### 📊 Project Management
- Create and manage multiple projects per client
- Assign subcontractors to specific projects
- Track project status (Active, Completed, On Hold, Cancelled)
- View project assignments and details

### 💰 Rate Card System
- Create custom rate cards for different service categories
- Assign specific rate cards to client-subcontractor relationships
- Track billing rates per project

### 📧 Email System
- Automated subcontractor invite emails with secure links
- Registration confirmation emails with trial information
- Invite acceptance notifications to company owners
- Professional branded templates from support@crewquo.com
- Powered by Resend for reliable delivery

### 🔐 Role-Based Access Control
- **Admin**: Full system access
- **Manager**: Manage projects, clients, and subcontractors
- **Viewer**: Read-only access
- **Subcontractor**: Limited access to assigned projects

### 📱 Responsive Design
- Works seamlessly on desktop, tablet, and mobile devices
- Modern, intuitive interface

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Cloud Functions)
- **Deployment**: Vercel
- **Payments**: Gumroad
- **Email**: Resend

---

## Quick Links

- 📖 [Setup Guide](./SETUP.md) - Get started with development
- 🚀 [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
- 💻 [Development Guide](./DEVELOPMENT.md) - Development workflows and architecture
- 📧 [Email Setup](./EMAIL_QUICKSTART.md) - Configure the email system (Quick Start)
- 📬 [Email Documentation](./EMAIL_SETUP.md) - Detailed email system documentation

---

## Project Structure

```
CrewQuo/
├── app/                      # Next.js App Router pages
│   ├── dashboard/           # Dashboard pages
│   ├── login/               # Authentication pages
│   └── signup/              # Registration pages
├── components/              # React components
├── lib/                     # Utilities and contexts
├── functions/               # Firebase Cloud Functions
│   └── src/
│       ├── email.ts         # Email service and templates
│       └── index.ts         # Cloud Functions
├── scripts/                 # Database seeding and management
└── firestore.rules         # Firebase security rules
```

---

## License

Proprietary - All rights reserved

---

## Support

For issues or questions, contact the development team.
