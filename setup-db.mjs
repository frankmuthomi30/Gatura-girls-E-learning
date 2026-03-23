/**
 * Gatura Girls Learning Portal — Database Setup Script
 * 
 * This script sets up the database schema and creates the admin user.
 * 
 * Usage:
 *   node setup-db.mjs <SERVICE_ROLE_KEY>
 * 
 * Or set SUPABASE_SERVICE_ROLE_KEY in .env.local first and run:
 *   node setup-db.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://qxiepbqdurkalvqwahxm.supabase.co';

// Get service role key from argument or .env.local
let SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  try {
    const envContent = readFileSync('.env.local', 'utf-8');
    const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (match && match[1] && !match[1].includes('PASTE')) {
      SERVICE_ROLE_KEY = match[1].trim();
    }
  } catch {}
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ No service role key provided.');
  console.error('Usage: node setup-db.mjs <YOUR_SERVICE_ROLE_KEY>');
  console.error('Or set SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log('🔌 Connecting to Supabase...');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test connection
const { data: testData, error: testError } = await supabase.from('profiles').select('count').limit(0);

// If profiles table doesn't exist yet, we need to run the schema
const needsSchema = testError && testError.message.includes('does not exist');

if (!testError) {
  console.log('✅ Database tables already exist!');
} else if (needsSchema) {
  console.log('📋 Tables not found — you need to run the SQL schema.');
  console.log('');
  console.log('Since raw SQL cannot be run via the REST API, please:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/qxiepbqdurkalvqwahxm/sql');
  console.log('2. Click "New query"');
  console.log('3. Copy ALL contents from: supabase-schema.sql');
  console.log('4. Paste into the SQL Editor and click "Run"');
  console.log('');
  console.log('After running the schema, re-run this script to create the admin user.');
  process.exit(0);
} else {
  console.error('❌ Connection error:', testError.message);
  process.exit(1);
}

// Check if admin exists
console.log('👤 Checking for admin user...');
const { data: existingAdmin } = await supabase
  .from('profiles')
  .select('id, admission_number')
  .eq('role', 'admin')
  .limit(1);

if (existingAdmin && existingAdmin.length > 0) {
  console.log(`✅ Admin already exists: ${existingAdmin[0].admission_number}`);
} else {
  console.log('👤 Creating admin user...');
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@gatura.school',
    password: '123456',
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('⚠️  Auth user admin@gatura.school already exists.');
      // Try to get the user
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const adminAuth = users?.find(u => u.email === 'admin@gatura.school');
      if (adminAuth) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: adminAuth.id,
          full_name: 'System Administrator',
          admission_number: '0000',
          role: 'admin',
          must_change_pin: true,
        });
        if (profileError) {
          console.error('❌ Profile error:', profileError.message);
        } else {
          console.log('✅ Admin profile created/updated');
        }
      }
    } else {
      console.error('❌ Auth error:', authError.message);
      process.exit(1);
    }
  } else {
    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      full_name: 'System Administrator',
      admission_number: '0000',
      role: 'admin',
      must_change_pin: true,
    });

    if (profileError) {
      console.error('❌ Profile error:', profileError.message);
    } else {
      console.log('✅ Admin user created!');
      console.log('   Admission Number: 0000');
      console.log('   Default PIN: 123456');
      console.log('   (You will be forced to change PIN on first login)');
    }
  }
}

// Update .env.local with the service role key if it was passed as argument
if (process.argv[2]) {
  try {
    let envContent = readFileSync('.env.local', 'utf-8');
    if (envContent.includes('PASTE_YOUR_SERVICE_ROLE_KEY_HERE')) {
      envContent = envContent.replace('PASTE_YOUR_SERVICE_ROLE_KEY_HERE', SERVICE_ROLE_KEY);
      const { writeFileSync } = await import('fs');
      writeFileSync('.env.local', envContent);
      console.log('✅ .env.local updated with service role key');
    }
  } catch {}
}

console.log('');
console.log('🎉 Setup complete! Run: npm run dev');
