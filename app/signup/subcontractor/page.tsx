'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserCheck, AlertCircle } from 'lucide-react';

function SubcontractorSignupContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [subcontractorData, setSubcontractorData] = useState<any>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError('Invalid or missing invite token');
      setLoading(false);
      return;
    }

    try {
      // Call Cloud Function to validate token (bypasses Firestore security rules)
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/lib/firebase');
      
      const validateInviteToken = httpsCallable(functions, 'validateInviteToken');
      const result = await validateInviteToken({ token });
      
      const data = result.data as any;
      
      if (!data.valid) {
        setError(data.error || 'This invite link is invalid or has already been used');
        setValidToken(false);
      } else {
        setSubcontractorData(data.subcontractor);
        setValidToken(true);
      }
    } catch (err: any) {
      console.error('Error validating token:', err);
      setError('Failed to validate invite link');
      setValidToken(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Create Firebase user with the email from the subcontractor record
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        subcontractorData.email,
        formData.password
      );

      const user = userCredential.user;

      // Check if user already has an own company (in case they were invited elsewhere first)
      const existingUserDoc = await getDoc(doc(db, 'users', user.uid));
      const hasOwnCompany = existingUserDoc.exists() && existingUserDoc.data()?.ownCompanyId;

      // Create own company if user doesn't have one (free plan by default)
      let ownCompanyId = user.uid;
      if (!hasOwnCompany) {
        const newCompanyRef = doc(db, 'companies', user.uid);
        await setDoc(newCompanyRef, {
          name: `${formData.firstName}'s Company`,
          ownerId: user.uid,
          subscriptionPlan: 'free',
          subscriptionStatus: 'inactive',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        ownCompanyId = existingUserDoc.data()!.ownCompanyId;
      }

      // Prepare subcontractor roles - add the inviting company
      const subcontractorRoles: any = {};
      subcontractorRoles[subcontractorData.companyId] = {
        subcontractorId: subcontractorData.id,
        status: 'active',
        joinedAt: serverTimestamp(),
      };

      // Create user profile with multi-company support
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: subcontractorData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyId: ownCompanyId, // Legacy field
        ownCompanyId: ownCompanyId, // NEW: Their primary company
        activeCompanyId: subcontractorData.companyId, // NEW: Set to inviting company
        role: 'ADMIN', // NEW: Role in their OWN company (they're the admin of their own company)
        subcontractorRoles: subcontractorRoles, // NEW: Track working relationships
        subscriptionPlan: 'free', // NEW: Default to free plan
        subscriptionStatus: 'inactive', // NEW: Inactive until they upgrade
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update subcontractor record to mark invite as accepted
      const subcontractorRef = doc(db, 'subcontractors', subcontractorData.id);
      await updateDoc(subcontractorRef, {
        userId: user.uid,
        inviteStatus: 'accepted',
        inviteAcceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // IMPORTANT: Refresh custom claims to ensure subcontractorRoles are available
      // This is critical for the My Work page to function properly
      try {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');
        const refreshClaims = httpsCallable(functions, 'refreshClaims');
        await refreshClaims();
        
        // Force token refresh on the client side
        await user.getIdToken(true);
        
        console.log('Custom claims refreshed successfully');
      } catch (claimsError) {
        console.error('Error refreshing claims:', claimsError);
        // Continue anyway - claims will be set by the trigger eventually
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite Link</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to CrewQuo
          </h1>
          <p className="text-gray-600">
            Complete your account setup to get started
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Invitation Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">You've been invited as:</p>
            <p className="text-lg font-semibold text-gray-900">{subcontractorData?.name}</p>
            <p className="text-sm text-gray-600">{subcontractorData?.email}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Your Information
              </h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> You will have access to work on projects within the CrewQuo platform. 
                You can also work for other companies within the app without affecting your work here.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating Account...' : 'Complete Setup'}
            </button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Log in
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SubcontractorSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <SubcontractorSignupContent />
    </Suspense>
  );
}
