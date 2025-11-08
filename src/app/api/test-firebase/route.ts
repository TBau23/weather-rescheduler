import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const testRef = await addDoc(collection(db, 'test'), {
      message: 'Firebase connected successfully!',
      timestamp: new Date(),
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Firebase is working!',
      documentId: testRef.id 
    });
  } catch (error) {
    console.error('Firebase test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

