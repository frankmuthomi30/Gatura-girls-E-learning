import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';

export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { studentIds } = await request.json();

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: 'No students selected' }, { status: 400 });
  }

  const { adminClient } = routeContext;

  let deleted = 0;
  const errors: string[] = [];

  // Delete all in parallel for speed
  const results = await Promise.allSettled(
    studentIds.map(async (id: string) => {
      await adminClient.from('submissions').delete().eq('student_id', id);
      await adminClient.from('profiles').delete().eq('id', id);
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) throw new Error(`auth: ${error.message}`);
    })
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      deleted++;
    } else {
      deleted++; // profile likely deleted, auth may have failed
      errors.push(`${studentIds[i]}: ${(results[i] as PromiseRejectedResult).reason?.message}`);
    }
  }

  return NextResponse.json({ deleted, errors });
}
