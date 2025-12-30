import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, companyId, role } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !companyId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN or MANAGER' },
        { status: 400 }
      );
    }

    // Verify company exists
    const companyDoc = await adminDb().collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // Create user document in Firestore
    const userData = {
      email,
      firstName,
      lastName,
      role,
      companyId,
      ownCompanyId: companyId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await adminDb().collection('users').doc(userRecord.uid).set(userData);

    // Set custom claims for the user
    await adminAuth().setCustomUserClaims(userRecord.uid, {
      role,
      companyId,
    });

    return NextResponse.json(
      { 
        success: true, 
        message: 'User created successfully',
        uid: userRecord.uid 
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating user:', error);

    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { error: 'Password is too weak' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
