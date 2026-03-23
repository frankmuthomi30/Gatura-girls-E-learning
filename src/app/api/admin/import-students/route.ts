import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { generateTemporaryPin } from '@/lib/pin';
import * as XLSX from 'xlsx';

const VALID_STREAMS = ['Blue', 'Green', 'Magenta', 'Red', 'White', 'Yellow'];

// Step 1: Parse Excel file and return rows (POST with action=parse)
// Step 2: Import a batch of rows (POST with action=import)
export async function POST(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const contentType = request.headers.get('content-type') || '';

  // --- STEP 1: Parse file, return rows ---
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const rows: { admission_number: string; full_name: string; stream: string }[] = [];

    for (const raw of rawRows) {
      const keys = Object.keys(raw);
      const admKey = keys.find(k => /adm|number|no\.?$/i.test(k)) || keys[0];
      const nameKey = keys.find(k => /name|student/i.test(k)) || keys[1];
      const streamKey = keys.find(k => /stream|class|house/i.test(k)) || keys[2];

      if (admKey && nameKey && streamKey) {
        rows.push({
          admission_number: String(raw[admKey]).trim(),
          full_name: String(raw[nameKey]).trim(),
          stream: String(raw[streamKey]).trim(),
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in file' }, { status: 400 });
    }

    return NextResponse.json({ rows });
  }

  // --- STEP 2: Import a batch of parsed rows ---
  const { adminClient } = routeContext;

  const body = await request.json();
  const rows = body.rows || [];
  const grade = body.grade;

  if (!grade || ![10, 11, 12].includes(grade)) {
    return NextResponse.json({ error: 'Invalid grade' }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const importedUsers: { admission_number: string; full_name: string; temporary_pin: string }[] = [];

  // Process all rows in parallel for speed
  const results = await Promise.allSettled(
    rows.map(async (row: any) => {
      const admissionNumber = String(row.admission_number || '').trim();
      const fullName = String(row.full_name || '').trim();
      const stream = String(row.stream || '').trim();

      if (!admissionNumber || !fullName || !stream) {
        throw new Error(`${admissionNumber || 'Row'}: Missing data`);
      }

      if (!VALID_STREAMS.includes(stream)) {
        throw new Error(`${admissionNumber}: Invalid stream "${stream}"`);
      }

      const email = `${admissionNumber}@gatura.school`;
      const temporaryPin = generateTemporaryPin();

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: temporaryPin,
        email_confirm: true,
      });

      if (authError) {
        const msg = authError.message.includes('already been registered')
          ? `${admissionNumber}: already exists`
          : `${admissionNumber}: ${authError.message}`;
        throw new Error(msg);
      }

      if (!authData.user) {
        throw new Error(`${admissionNumber}: Failed to create auth user`);
      }

      const { error: profileError } = await adminClient
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          admission_number: admissionNumber,
          role: 'student',
          stream,
          grade,
          academic_year: 2026,
          must_change_pin: true,
        });

      if (profileError) {
        await adminClient.auth.admin.deleteUser(authData.user.id);
        throw new Error(`${admissionNumber}: ${profileError.message}`);
      }

      return {
        admission_number: admissionNumber,
        full_name: fullName,
        temporary_pin: temporaryPin,
      };
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      success++;
      importedUsers.push(r.value);
    } else {
      failed++;
      errors.push(r.reason?.message || 'Unknown error');
    }
  }

  return NextResponse.json({ success, failed, errors, importedUsers });
}
