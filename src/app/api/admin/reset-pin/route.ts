import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { generateTemporaryPin } from '@/lib/pin';

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

  const temporaryPin = generateTemporaryPin();

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: temporaryPin,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set must_change_pin flag
  await adminClient
    .from('profiles')
    .update({ must_change_pin: true })
    .eq('id', userId);

  return NextResponse.json({ success: true, temporary_pin: temporaryPin });
}
