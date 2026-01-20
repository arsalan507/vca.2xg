#!/usr/bin/env node
/**
 * Script to fix duplicate content_id issues in viral_analyses table
 *
 * This script provides instructions to run the SQL migration that will:
 * 1. Fix existing duplicates
 * 2. Update the trigger to use row-level locking (prevents race conditions)
 * 3. Ensure unique constraint is in place
 *
 * Usage:
 *   node run-content-id-fix.js
 */

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  FIX: Duplicate content_id Error in Production');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('🔍 PROBLEM:');
console.log('   When submitting analyses, you see this error:');
console.log('   "duplicate key value violates unique constraint');
console.log('    viral_analyses_content_id_unique"');
console.log('');
console.log('💡 SOLUTION:');
console.log('   Run the SQL migration to fix the database trigger');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('OPTION 1: Supabase Dashboard (RECOMMENDED - Easiest)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('1. Go to Supabase Dashboard:');
console.log('   https://supabase.com/dashboard');
console.log('');
console.log('2. Select your project');
console.log('');
console.log('3. Navigate to: SQL Editor → New query');
console.log('');
console.log('4. Open this file: FIX-DUPLICATE-CONTENT-IDS-V5-SEQUENCES.sql');
console.log('   Copy ALL the contents');
console.log('');
console.log('5. Paste into the SQL Editor and click "Run"');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('OPTION 2: Command Line (Advanced)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('If you have psql installed and your DB connection string:');
console.log('');
console.log('  psql "YOUR_POSTGRES_CONNECTION_STRING" -f FIX-DUPLICATE-CONTENT-IDS-V5-SEQUENCES.sql');
console.log('');
console.log('Get your connection string from Supabase Dashboard:');
console.log('  Settings → Database → Connection string (Session pooler)');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('✅ WHAT THIS FIX DOES:');
console.log('   • Fixes all existing duplicate content_ids');
console.log('   • Uses atomic sequence table (UPDATE ... RETURNING)');
console.log('   • Guaranteed race-condition free in ALL scenarios');
console.log('   • Works with Supabase pooled connections');
console.log('   • No code changes needed - pure database fix');
console.log('');
console.log('📖 For detailed information, see: FIX-DUPLICATE-CONTENT-ID-GUIDE.md');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
