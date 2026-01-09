/**
 * Token Refresh Utility
 * Handles refreshing Firebase authentication tokens to get updated custom claims
 */

import { auth } from './firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Refresh the user's Firebase ID token to get updated custom claims
 * This forces the client to fetch a new token with the latest claims from the server
 */
export async function refreshAuthToken(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      console.warn('No authenticated user to refresh token for');
      return false;
    }

    // Force token refresh - this gets a new token with updated claims
    await user.getIdToken(true);
    
    console.log('✅ Auth token refreshed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error refreshing auth token:', error);
    return false;
  }
}

/**
 * Call the Cloud Function to refresh user custom claims in Firebase Auth
 * Then refresh the local token to get the updated claims
 */
export async function refreshUserClaims(forceReload: boolean = false): Promise<boolean> {
  try {
    const functions = getFunctions();
    const refreshClaims = httpsCallable(functions, 'refreshClaims');
    
    // Call the cloud function to update claims on the server
    const result = await refreshClaims();
    
    if (result.data && (result.data as any).success) {
      // Now refresh the local token to get the updated claims
      await refreshAuthToken();
      console.log('✅ User claims refreshed successfully');
      
      // Force page reload to ensure all queries use the new token
      if (forceReload) {
        console.log('🔄 Reloading page to apply new permissions...');
        window.location.reload();
      }
      
      return true;
    }
    
    console.warn('⚠️ Claims refresh returned unsuccessful result');
    return false;
  } catch (error) {
    console.error('❌ Error refreshing user claims:', error);
    return false;
  }
}

/**
 * Check if a Firebase error is a permission error
 */
export function isPermissionError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('permission') ||
    message.includes('insufficient') ||
    message.includes('missing') ||
    code.includes('permission-denied') ||
    code === 'permission-denied'
  );
}

/**
 * Retry a function after refreshing the auth token
 * Useful for handling stale token errors automatically
 */
export async function retryWithTokenRefresh<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Only retry on permission errors
      if (isPermissionError(error) && attempt < maxRetries) {
        console.log(`Permission error detected, refreshing token and retrying (attempt ${attempt + 1}/${maxRetries})...`);
        
        // Try to refresh claims and token (without reload during retry)
        await refreshUserClaims(false);
        
        // Wait a bit before retrying to allow claims to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        continue;
      }
      
      // If not a permission error or max retries reached, throw
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Handle permission errors with automatic retry logic
 * Shows user-friendly messages and attempts to fix the issue
 */
export async function handlePermissionError(
  error: any,
  retryFn?: () => Promise<void>
): Promise<{
  shouldRetry: boolean;
  message: string;
}> {
  if (!isPermissionError(error)) {
    return {
      shouldRetry: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }

  console.log('🔄 Permission error detected, attempting to refresh token...');
  
  try {
    // Try to refresh claims
    const refreshed = await refreshUserClaims();
    
    if (refreshed && retryFn) {
      // Wait a moment for claims to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry the operation
      await retryFn();
      
      return {
        shouldRetry: false,
        message: 'Access refreshed successfully!',
      };
    }
    
    return {
      shouldRetry: true,
      message: 'Your access permissions have been refreshed. Please try again.',
    };
  } catch (refreshError) {
    console.error('Failed to refresh permissions:', refreshError);
    
    return {
      shouldRetry: false,
      message: 'Unable to refresh your access. Please sign out and sign back in.',
    };
  }
}
