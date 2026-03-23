import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';

export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { teacherId } = await request.json();

  if (!teacherId) {
    return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });
  }

  const { adminClient } = routeContext;

  // Unassign teacher from all subjects
  await adminClient
    .from('subjects')
    .update({ teacher_id: null })
    .eq('teacher_id', teacherId);

  // Delete profile then auth user
  await adminClient.from('profiles').delete().eq('id', teacherId);
  const { error: authError } = await adminClient.auth.admin.deleteUser(teacherId);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
