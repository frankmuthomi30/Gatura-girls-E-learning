import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { generateTemporaryPassword } from '@/lib/pin';

const DEFAULT_STUDENT_PASSWORD = '12345678';

export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { adminClient } = routeContext;

  const { full_name, admission_number, role } = await request.json();

  if (!full_name?.trim() || !admission_number?.trim()) {
    return NextResponse.json({ error: 'Name and ID are required' }, { status: 400 });
  }

  const validRoles = ['teacher', 'student'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const normalizedAdmissionNumber = admission_number.trim();
  const email = `${normalizedAdmissionNumber}@gatura.school`;
  // Students get a well-known default password; staff get a strong random one
  const temporaryCredential = role === 'student' ? DEFAULT_STUDENT_PASSWORD : generateTemporaryPassword();

  // Create auth user with admin API (no rate limit, no email sent)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryCredential,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  if (!authData.user) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }

  // Create profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: full_name.trim(),
      admission_number: normalizedAdmissionNumber,
      role,
      must_change_pin: true,
    });

  if (profileError) {
    // Clean up auth user if profile insert fails
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    user: { 
      id: authData.user.id, 
      full_name: full_name.trim(),
      admission_number: normalizedAdmissionNumber,
      role,
      temporary_pin: temporaryCredential,
    } 
  });
}
