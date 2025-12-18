# Setup Guide

Get your development environment up and running.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Firebase CLI**: `npm install -g firebase-tools`
- **Git**
- **Firebase Project** (create at https://console.firebase.google.com)

---

## 1. Clone the Repository

```bash
git clone https://github.com/nobledev89/CrewQuo.git
cd CrewQuo
```

---

## 2. Install Dependencies

```bash
# Install main dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..
```

---

## 3. Firebase Setup

### Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable **Authentication** (Email/Password provider)
4. Enable **Firestore Database** (Start in production mode)
5. Enable **Cloud Storage**

### Get Firebase Configuration
1. In Firebase Console, go to **Project Settings** → **General**
2. Scroll to "Your apps" → Click **Web app** icon
3. Register your app
4. Copy the configuration values

---

## 4. Environment Variables

Create `.env.local` in the project root:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gumroad Configuration
NEXT_PUBLIC_GUMROAD_PRODUCT_PERMALINK=zxjxzj
```

---

## 5. Firebase Security Rules

Deploy Firestore and Storage rules:

```bash
firebase login
firebase init  # Select existing project
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## 6. Seed Database (Optional)

Seed test data for development:

```bash
# Create admin user
npx tsx scripts/create-admin-user.ts

# Seed test data
npx tsx scripts/seed-test-data.ts
```

---

## 7. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

---

## 8. Firebase Emulators (Optional)

For local development without touching production:

```bash
firebase emulators:start
```

Update `.env.local` to point to emulators:
```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
```

---

## Troubleshooting

### Build Errors
```bash
# Clean build
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Firebase Connection Issues
- Verify `.env.local` values match Firebase Console
- Check Firebase project is in Blaze (pay-as-you-go) plan for Cloud Functions
- Ensure Firestore rules are deployed

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000
```

---

## Next Steps

- 📖 Read [DEVELOPMENT.md](./DEVELOPMENT.md) for development workflows
- 🚀 See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
