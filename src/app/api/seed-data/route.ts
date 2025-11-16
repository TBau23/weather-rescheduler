import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase, clearCollections } from '@/scripts/seed-data';

/**
 * POST /api/seed-data
 * 
 * Seeds the database with test data
 * Query params:
 *   - clear=true : Clear existing data before seeding
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clearFirst = searchParams.get('clear') === 'true';

    console.log('🌱 Seeding database via API...');
    
    if (clearFirst) {
      console.log('🗑️  Clearing existing data first...');
      await clearCollections();
    }
    
    const result = await seedDatabase(false); // Don't clear again

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      data: result,
    });
  } catch (error) {
    console.error('❌ Seed error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * DELETE /api/seed-data
 * 
 * Clears all data from collections
 */
export async function DELETE() {
  try {
    console.log('🗑️  Clearing database via API...');
    await clearCollections();

    return NextResponse.json({
      success: true,
      message: 'All collections cleared successfully!',
    });
  } catch (error) {
    console.error('❌ Clear error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

