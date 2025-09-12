// app/api/recommended/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string }}) {
  const { data, error } = await supabase
    .from('recommended_items')
    .delete()
    .eq('id', params.id)
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'delete-failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: data?.length || 0 });
}