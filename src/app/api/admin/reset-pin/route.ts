import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { generateTemporaryPin, generateTemporaryPassword } from '@/lib/pin';

export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { adminClient } = routeContext;

  // Check the user's role to determine credential type
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const isStaff = targetProfile?.role === 'admin' || targetProfile?.role === 'teacher';
  const temporaryCredential = isStaff ? generateTemporaryPassword() : generateTemporaryPin();

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: temporaryCredential,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set must_change_pin flag
  await adminClient
    .from('profiles')
    .update({ must_change_pin: true })
    .eq('id', userId);

  return NextResponse.json({ success: true, temporary_pin: temporaryCredential });
}
