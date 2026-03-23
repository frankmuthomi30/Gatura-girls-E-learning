/**
 * Gatura Girls Learning Portal — Complete Database Setup
 * Runs the full schema against Supabase using the service role key.
 * 
 * Usage: node setup-complete.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://qxiepbqdurkalvqwahxm.supabase.co';

// Read from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const serviceKey = keyMatch?.[1]?.trim();

if (!serviceKey) {
  console.error('No service role key found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// We'll use Supabase's rpc after creating a helper function
// First, let's check if tables already exist by trying to query
async function tablesExist() {
  const { error } = await supabase.from('profiles').select('id').limit(0);
  return !error;
}

async function main() {
  console.log('🔌 Connecting to Supabase...');
  
  // Test connection
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
  console.log('✅ Connected! Auth service is working.');

  // Check if tables exist
  const exists = await tablesExist();
  
  if (exists) {
    console.log('✅ Database tables already exist!');
  } else {
    console.log('');
    console.log('⚠️  Tables do not exist yet.');
    console.log('');
    console.log('The Supabase REST API cannot run raw DDL (CREATE TABLE) statements.');
    console.log('You need to run the SQL schema via the SQL Editor in the dashboard.');
    console.log('');
    console.log('👉 Open: https://supabase.com/dashboard/project/qxiepbqdurkalvqwahxm/sql');
    console.log('');
    console.log('1. Click "New query"');
    console.log('2. Copy ALL content from supabase-schema.sql');
    console.log('3. Paste it and click "Run"');
    console.log('');
    console.log('After that, re-run this script to create the admin user.');
    process.exit(0);
  }

  // =============================================
  // CREATE ADMIN USER
  // =============================================
  console.log('');
  console.log('👤 Setting up admin user...');

  // Check if admin profile exists
  const { data: existingAdmin } = await supabase
    .from('profiles')
    .select('id, admission_number, full_name')
    .eq('role', 'admin')
    .limit(1);

  if (existingAdmin && existingAdmin.length > 0) {
    console.log(`✅ Admin already exists: ${existingAdmin[0].full_name} (${existingAdmin[0].admission_number})`);
  } else {
    // Check if auth user exists
    const { data: { users } } = await supabase.auth.admin.listUsers();
    let adminAuthUser = users?.find(u => u.email === 'admin@gatura.school');

    if (!adminAuthUser) {
      console.log('   Creating auth user: admin@gatura.school ...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@gatura.school',
        password: '123456',
        email_confirm: true,
      });

      if (createError) {
        console.error('❌ Failed to create auth user:', createError.message);
        process.exit(1);
      }
      adminAuthUser = newUser.user;
      console.log('   ✅ Auth user created');
    } else {
      console.log('   Auth user already exists');
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: adminAuthUser.id,
        full_name: 'System Administrator',
        admission_number: '0000',
        role: 'admin',
        must_change_pin: true,
      });

    if (profileError) {
      console.error('❌ Failed to create admin profile:', profileError.message);
    } else {
      console.log('   ✅ Admin profile created');
      console.log('');
      console.log('   ┌──────────────────────────────────┐');
      console.log('   │  ADMIN LOGIN CREDENTIALS          │');
      console.log('   │  Admission Number: 0000           │');
      console.log('   │  PIN: 123456                      │');
      console.log('   │  (Must change on first login)     │');
      console.log('   └──────────────────────────────────┘');
    }
  }

  // =============================================
  // VERIFY SEED DATA
  // =============================================
  console.log('');
  console.log('📋 Checking seed data...');

  const { data: streams } = await supabase.from('streams').select('name');
  console.log(`   Streams: ${streams?.map(s => s.name).join(', ') || 'none'}`);

  const { data: years } = await supabase.from('academic_years').select('year, is_active');
  console.log(`   Academic years: ${years?.map(y => `${y.year}${y.is_active ? ' (active)' : ''}`).join(', ') || 'none'}`);

  const { data: profileCount } = await supabase.from('profiles').select('role');
  const roles = profileCount?.reduce((acc, p) => { acc[p.role] = (acc[p.role] || 0) + 1; return acc; }, {});
  console.log(`   Users: ${JSON.stringify(roles || {})}`);

  console.log('');
  console.log('🎉 Setup complete! Run: npm run dev');
  console.log('   Then open: http://localhost:3000');
}

main().catch(e => {
  console.error('❌ Unexpected error:', e.message);
  process.exit(1);
});
