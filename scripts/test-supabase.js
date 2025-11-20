#!/usr/bin/env node

/**
 * Supabase Integration Test Script
 * Tests the complete audio upload flow to Supabase
 * 
 * Usage: node scripts/test-supabase.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Test database connection and schema
 */
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Users table error:', usersError.message);
      return false;
    }
    
    // Test recordings table
    const { data: recordings, error: recordingsError } = await supabase
      .from('recordings')
      .select('count')
      .limit(1);
    
    if (recordingsError) {
      console.error('❌ Recordings table error:', recordingsError.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Test storage bucket access
 */
async function testStorageAccess() {
  console.log('🔍 Testing storage access...');
  
  try {
    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Storage buckets error:', bucketsError.message);
      return false;
    }
    
    const audioBucket = buckets.find(bucket => bucket.name === 'audio-recordings');
    
    if (!audioBucket) {
      console.error('❌ Audio recordings bucket not found');
      console.log('Available buckets:', buckets.map(b => b.name));
      return false;
    }
    
    console.log('✅ Storage bucket access successful');
    return true;
  } catch (error) {
    console.error('❌ Storage access failed:', error.message);
    return false;
  }
}

/**
 * Test file upload functionality
 */
async function testFileUpload() {
  console.log('🔍 Testing file upload...');
  
  try {
    // Create a test audio file (empty WebM file)
    const testContent = new Uint8Array([
      0x1A, 0x45, 0xDF, 0xA3, // EBML header
      0x9F, 0x42, 0x86, 0x81, // EBML version
      0x01, 0x42, 0xF7, 0x81, // EBML read version
      0x01, 0x42, 0xF2, 0x81, // EBML max ID length
      0x01, 0x42, 0xF3, 0x81, // EBML max size length
      0x01, 0x42, 0x82, 0x84, // Doc type
      0x77, 0x65, 0x62, 0x6D, // "webm"
      0x42, 0x87, 0x81, 0x02, // Doc type version
      0x42, 0x85, 0x81, 0x02  // Doc type read version
    ]);
    
    const testFile = new File([testContent], 'test-audio.webm', { type: 'audio/webm' });
    const testPath = `test/user123/sentence1/test-file.webm`;
    
    // Upload test file
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .upload(testPath, testFile, {
        upsert: true,
        contentType: 'audio/webm'
      });
    
    if (error) {
      console.error('❌ File upload error:', error.message);
      return false;
    }
    
    console.log('✅ File upload successful:', data.path);
    
    // Clean up test file
    const { error: deleteError } = await supabase.storage
      .from('audio-recordings')
      .remove([testPath]);
    
    if (deleteError) {
      console.warn('⚠️ Failed to clean up test file:', deleteError.message);
    } else {
      console.log('✅ Test file cleaned up');
    }
    
    return true;
  } catch (error) {
    console.error('❌ File upload test failed:', error.message);
    return false;
  }
}

/**
 * Test database operations
 */
async function testDatabaseOperations() {
  console.log('🔍 Testing database operations...');
  
  try {
    const testUserId = 'test-user-' + Date.now();
    const testUserEmail = `test-${Date.now()}@example.com`;
    
    // Test user creation
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: testUserEmail,
        name: 'Test User'
      })
      .select()
      .single();
    
    if (userError) {
      console.error('❌ User creation error:', userError.message);
      return false;
    }
    
    console.log('✅ User creation successful:', user.id);
    
    // Test recording creation
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .insert({
        user_id: testUserId,
        sentence_id: 1,
        slot_index: 0,
        audio_url: 'https://example.com/test.webm',
        file_path: 'test/path/test.webm',
        duration: 5000,
        file_size: 102400,
        label: 'test'
      })
      .select()
      .single();
    
    if (recordingError) {
      console.error('❌ Recording creation error:', recordingError.message);
      return false;
    }
    
    console.log('✅ Recording creation successful:', recording.id);
    
    // Clean up test data
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', testUserId);
    
    if (deleteUserError) {
      console.warn('⚠️ Failed to clean up test user:', deleteUserError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database operations test failed:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Supabase integration tests...\n');
  
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Storage Access', fn: testStorageAccess },
    { name: 'File Upload', fn: testFileUpload },
    { name: 'Database Operations', fn: testDatabaseOperations }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Running: ${test.name}`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed with error:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Supabase integration is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the configuration.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };


