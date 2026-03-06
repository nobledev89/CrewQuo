import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const clientId = searchParams.get('clientId');

    if (!companyId || !clientId) {
      return NextResponse.json(
        { error: 'Missing companyId or clientId' },
        { status: 400 }
      );
    }

    // Use Firebase Admin SDK to query projects (bypasses security rules)
    const db = adminDb();
    const projectsSnapshot = await db
      .collection('projects')
      .where('companyId', '==', companyId)
      .where('clientId', '==', clientId)
      .get();

    const projects = projectsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
