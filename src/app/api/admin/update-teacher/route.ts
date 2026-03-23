import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';

export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { teacherId, full_name, admission_number } = await request.json();

  if (!teacherId || !full_name?.trim() || !admission_number?.trim()) {
    return NextResponse.json({ error: 'Teacher ID, name and staff ID are required' }, { status: 400 });
  }

  const { adminClient } = routeContext;
  const normalizedFullName = full_name.trim();
  const normalizedAdmissionNumber = admission_number.trim();

  const { data: existingTeacher, error: teacherLookupError } = await adminClient
    .from('profiles')
    .select('full_name, admission_number')
    .eq('id', teacherId)
    .eq('role', 'teacher')
    .single();

  if (teacherLookupError || !existingTeacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
  }

  const previousEmail = `${existingTeacher.admission_number.trim()}@gatura.school`;
  const newEmail = `${normalizedAdmissionNumber}@gatura.school`;

  if (newEmail !== previousEmail) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(teacherId, {
      email: newEmail,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: normalizedFullName,
      admission_number: normalizedAdmissionNumber,
    })
    .eq('id', teacherId)
    .eq('role', 'teacher');

  if (profileError) {
    if (newEmail !== previousEmail) {
      await adminClient.auth.admin.updateUserById(teacherId, {
        email: previousEmail,
      });
    }

    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
