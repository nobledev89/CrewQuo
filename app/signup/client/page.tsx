'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getInviteByToken, acceptClientUserInvite } from '@/lib/clientAccessUtils';
import type { ClientUserInvite } from '@/lib/types';
import { Building2, Mail, Lock, User, CheckCircle, X, XCircle } from 'lucide-react';

function ClientSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [invite, setInvite] = useState<ClientUserInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Please contact your contractor.');
      setLoading(false);
      return;
    }

    // Validate token using Cloud Function (bypasses security rules)
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/lib/firebase');
      
      const validateClientInviteToken = httpsCallable(functions, 'validateClientInviteToken');
      const result = await validateClientInviteToken({ token });
      
      const data = result.data as any;
      
      if (!data.valid) {
        setError(data.error || 'This invitation is invalid or has expired');
        setInvite(null);
      } else {
        setInvite({ id: data.invite.id, ...data.invite } as ClientUserInvite);
      }
    } catch (err: any) {
      console.error('Error validating invite:', err);
      setError('Failed to validate invitation. Please try again.');
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

    if (!invite) {
      setError('Invalid invitation');
      return;
    }

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      // Create new user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invite.email,
        formData.password
      );
      const userId = userCredential.user.uid;

      // Create user document
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: invite.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: 'CLIENT',
        clientOrgId: invite.clientOrgId,
        clientOrgName: invite.clientOrgName,
        contractorCompanyIds: [invite.contractorCompanyId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create clientUser document
      await addDoc(collection(db, 'clientUsers'), {
        userId,
        clientOrgId: invite.clientOrgId,
        clientOrgName: invite.clientOrgName,
        email: invite.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: 'VIEWER',
        active: true,
        contractorCompanyIds: [invite.contractorCompanyId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Accept invite (update invite status to accepted)
      await updateDoc(doc(db, 'clientUserInvites', invite.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      // Refresh custom claims via Cloud Function
      try {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');
        const refreshClaims = httpsCallable(functions, 'refreshClaims');
        await refreshClaims();
        
        // Force token refresh on the client side
        await userCredential.user.getIdToken(true);
        
        console.log('Custom claims refreshed successfully');
      } catch (claimsError) {
        console.error('Error refreshing claims:', claimsError);
        // Continue anyway - claims will be set by the trigger eventually
      }

      alert('Account created successfully! Welcome to the Client Portal.');
      router.push('/dashboard/client-portal');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Invitation Link Expired</h2>
          <p className="text-gray-600 mb-2">Sorry, this invitation link is no longer valid.</p>
          <p className="text-sm text-gray-500 mb-6">
            This may have happened because the link has expired, was cancelled, or has already been used.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
            <p className="text-sm text-blue-800 font-semibold mb-2">📧 Need a new invitation?</p>
            <p className="text-xs text-blue-700">
              Please contact your contractor to send you a new invitation link.
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <button
              onClick={() => router.push('/login')}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Go to Login
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Client Portal</h2>
          <p className="text-gray-600">You've been invited by {invite?.contractorCompanyName}</p>
        </div>

        {/* Invitation Info */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Organization:</strong> {invite?.clientOrgName}
          </p>
          <p className="text-sm text-blue-800">
            <strong>Email:</strong> {invite?.email}
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Smith"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 font-semibold"
          >
            {submitting ? 'Creating Account...' : 'Create Account & Join'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ClientSignupForm />
    </Suspense>
  );
}
