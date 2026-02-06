# Super Admin Dashboard - Setup Guide

## Overview

The Super Admin Dashboard provides complete system-level access to manage all users, companies, subscriptions, and system settings across your CrewQuo platform.

## Features

### 📊 Dashboard Overview
- **Total Users**: View all registered users across all companies
- **Total Companies**: See all organizations on the platform
- **Subscription Stats**: Active, trial, and inactive subscription counts
- **Monthly Recurring Revenue (MRR)**: Revenue calculations based on pricing configuration
- **Plan Distribution**: Visual breakdown of subscriptions by plan (Free, Starter, Professional, Enterprise)

### 👥 User Management
- **View All Users**: Complete list with email, name, company, plan, status, and trial days remaining
- **Search & Filter**: Search by email, name, or company; filter by plan and status
- **Update Subscriptions**: Change user's plan and status
- **Suspend/Activate Users**: Control user access
- **Extend Trials**: Add days to trial periods
- **Export to CSV**: Download user data for analysis

### 🏢 Company Management
- **View All Companies**: List all organizations with owner, plan, status, and creation date
- **Monitor Trials**: See trial expiration dates and days remaining
- **Trial Warnings**: Highlight companies with trials expiring soon (< 7 days)

### 🔍 Advanced Features
- **Trial Expiring Soon**: Quick view of users/companies with trials ending within 7 days
- **Real-time Updates**: Data refreshes to show current state
- **Full CRUD Operations**: Create, Read, Update, and Delete capabilities

## Setup Instructions

### Step 1: Create Your Super Admin Account

1. Go to your CrewQuo signup page: `http://localhost:3000/signup`
2. Create an account using the email: **dpnh1989@gmail.com**
3. Use the password: **Donpablo1706**
4. Complete the signup process

### Step 2: Grant Super Admin Privileges

Once your account is created, run this command from the project root:

\`\`\`bash
node scripts/make-super-admin.js grant dpnh1989@gmail.com
\`\`\`

You should see output like:
\`\`\`
🔐 Granting super admin privileges to: dpnh1989@gmail.com

✅ Found user: [user-id]
✅ Custom claims set
✅ User document updated in Firestore

✅ Super admin privileges granted successfully!

Custom Claims:
{
  "isSuperAdmin": true,
  "role": "SUPER_ADMIN",
  "ownCompanyId": "[user-id]",
  "activeCompanyId": "[user-id]"
}

⚠️  User must log out and log back in for changes to take effect.
\`\`\`

### Step 3: Access the Super Admin Dashboard

1. **Log out** of your current session (if logged in)
2. **Log back in** with your super admin credentials
3. Navigate to: `http://localhost:3000/super-admin`
4. You should now see the Super Admin Dashboard with full system access

## Access URLs

- **Super Admin Dashboard**: `/super-admin`
- **Regular Dashboard**: `/dashboard` (still accessible)

## Security Features

### Route Protection
- The `/super-admin` route is protected by middleware
- Only users with `isSuperAdmin: true` custom claim can access
- Non-super-admins are automatically redirected to `/dashboard`

### Firestore Security Rules
- Super admins have read/write access to all collections:
  - `/users` - All user accounts
  - `/companies` - All companies
  - `/systemSettings` - Pricing and configuration
  - All other collections (projects, clients, etc.)

### Custom Claims
Super admins receive special authentication claims:
- `isSuperAdmin: true`
- `role: 'SUPER_ADMIN'`
- Separate from regular company hierarchy

## Usage Guide

### Managing User Subscriptions

1. Navigate to the **Users** tab
2. Find the user you want to modify
3. Click the **Edit** icon (pencil)
4. Enter new plan: `free`, `starter`, `professional`, or `enterprise`
5. Enter new status: `active`, `trial`, or `inactive`
6. Changes are immediate

### Suspending Users

1. Go to the **Users** tab
2. Click the **Suspend** icon (X circle) next to the user
3. Confirm the action
4. User's status will be set to `inactive`

### Extending Trials

1. In the **Users** tab, find users with `trial` status
2. Click the **Clock** icon
3. Enter number of days to extend (e.g., 14)
4. New trial end date is calculated and applied

### Exporting Data

1. In the **Users** tab
2. Click the **Export CSV** button
3. A CSV file downloads with all user data
4. File includes: Email, Name, Company, Role, Plan, Status, Trial Days, Created Date

### Monitoring Trial Expirations

The **Overview** tab shows a "Trial Expiring Soon" section that lists:
- Users with trials ending in less than 7 days
- Email, company name, and days remaining
- Highlighted in red for urgent attention

## Pricing Configuration

### Current Default Pricing
- **Free**: £0/month
- **Starter**: £29/month
- **Professional**: £79/month
- **Enterprise**: £199/month

### Customizing Pricing
To update pricing (future feature):
1. Edit values in `/systemSettings/pricing` in Firestore
2. Or use the pricing configuration page (coming soon)

### MRR Calculation
Monthly Recurring Revenue is calculated as:
```
MRR = (Active Free * £0) + (Active Starter * £29) + (Active Professional * £79) + (Active Enterprise * £199)
```

## Script Commands

### Grant Super Admin Access
\`\`\`bash
node scripts/make-super-admin.js grant <email>
\`\`\`

### Revoke Super Admin Access
\`\`\`bash
node scripts/make-super-admin.js revoke <email>
\`\`\`

## Troubleshooting

### Issue: "Not authorized" or redirect to /dashboard
**Solution**: Make sure you:
1. Ran the grant script successfully
2. Logged out completely
3. Cleared browser cache/cookies
4. Logged back in
5. The custom claims need a fresh login to take effect

### Issue: "User record not found"
**Solution**: Create the account first at `/signup` before running the grant script

### Issue: Can't see any data
**Solution**: 
1. Check Firestore security rules are deployed: `firebase deploy --only firestore:rules`
2. Verify your custom claims with: `node scripts/verify-auth-claims.ts <email>`
3. Check browser console for errors

### Issue: Changes not saving
**Solution**:
1. Check Firestore security rules allow super admin write access
2. Verify you have internet connection (Firestore is cloud-based)
3. Check browser console for specific error messages

## Best Practices

1. **Use Sparingly**: Super admin access is powerful - only grant to trusted individuals
2. **Regular Audits**: Periodically review who has super admin access
3. **Log Actions**: Consider implementing action logging for accountability
4. **Backup Data**: Before bulk operations, export data as backup
5. **Test in Development**: Always test super admin operations in development first

## Future Enhancements

Planned features for the super admin dashboard:
- [ ] Dynamic pricing configuration UI
- [ ] Activity logs and audit trails
- [ ] Bulk user operations
- [ ] Revenue analytics charts
- [ ] Email notification system
- [ ] User impersonation (for support)
- [ ] System health monitoring
- [ ] Automated trial expiry emails
- [ ] Payment integration status
- [ ] Company usage statistics

## Support

If you encounter issues with the super admin dashboard:
1. Check this documentation first
2. Review browser console for error messages
3. Verify Firestore security rules are deployed
4. Ensure you're logged in with correct credentials
5. Try clearing cache and logging in again

## Security Notice

⚠️ **IMPORTANT**: The super admin dashboard provides complete access to all user data and system settings. Keep your super admin credentials secure and only grant this access to trusted administrators.

- Never share super admin credentials
- Use strong, unique passwords
- Enable 2FA if available
- Regular security audits recommended
- Log all super admin actions

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Maintained By**: CrewQuo Development Team
