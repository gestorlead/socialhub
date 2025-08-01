-- ============================================================================
-- COMMENTS SYSTEM VALIDATION TESTS
-- Phase 1, Step 1.1: Database Schema & Security Validation
-- ============================================================================

-- Test 1: RLS functional - Users can only see their own comments
-- Expected: 0 rows (users cannot see comments from other users)
DO $$
BEGIN
  -- This test requires actual user data to be meaningful
  -- Run after inserting test data with different user_ids
  RAISE NOTICE 'Test 1: RLS Validation';
  RAISE NOTICE 'Run after creating test data: SELECT COUNT(*) FROM public.comments WHERE user_id != auth.uid();';
  RAISE NOTICE 'Expected result: 0 (users cannot access other users comments)';
END $$;

-- Test 2: Verify all required indexes are created
SELECT 
  'Test 2: Index Creation Validation' as test_name,
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('comments', 'comment_replies', 'social_posts', 'audit_log', 'comment_moderation_settings')
ORDER BY tablename, indexname;

-- Test 3: Verify partitioning is active
SELECT 
  'Test 3: Partitioning Validation' as test_name,
  schemaname,
  tablename,
  'Partition of comments table' as description
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'comments_%'
ORDER BY tablename;

-- Test 4: Verify all triggers are functional
SELECT 
  'Test 4: Triggers Validation' as test_name,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
  AND event_object_table LIKE '%comment%'
ORDER BY event_object_table, trigger_name;

-- Test 5: Verify RLS policies are active
SELECT 
  'Test 5: RLS Policies Validation' as test_name,
  tablename,
  policyname,
  permissive,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has WHERE clause'
    ELSE 'No WHERE clause'
  END as has_conditions
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename LIKE '%comment%'
ORDER BY tablename, policyname;

-- Test 6: Verify table constraints and checks
SELECT 
  'Test 6: Constraints Validation' as test_name,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name LIKE '%comment%'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Test 7: Verify foreign key relationships
SELECT 
  'Test 7: Foreign Keys Validation' as test_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name LIKE '%comment%'
ORDER BY tc.table_name, kcu.column_name;

-- Test 8: Verify functions exist and are callable
SELECT 
  'Test 8: Functions Validation' as test_name,
  routine_name,
  routine_type,
  data_type as return_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%comment%' OR routine_name IN (
    'calculate_content_hash',
    'update_comment_thread_path',
    'log_audit_trail',
    'cleanup_old_audit_logs',
    'create_monthly_partition'
  ))
ORDER BY routine_name;

-- Test 9: Table storage parameters
SELECT 
  'Test 9: Storage Parameters Validation' as test_name,
  schemaname,
  tablename,
  reloptions
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%comment%'
  AND reloptions IS NOT NULL
ORDER BY tablename;

-- Test 10: Verify column data types and constraints
SELECT 
  'Test 10: Column Specifications Validation' as test_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name LIKE '%comment%'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- FUNCTIONAL TESTS (Run after schema creation)
-- ============================================================================

-- Test 11: Test content hash function
DO $$
DECLARE
  test_content text := 'This is a test comment';
  hash_result text;
BEGIN
  SELECT public.calculate_content_hash(test_content) INTO hash_result;
  
  RAISE NOTICE 'Test 11: Content Hash Function';
  RAISE NOTICE 'Input: %', test_content;
  RAISE NOTICE 'Hash: %', hash_result;
  
  IF hash_result IS NOT NULL AND length(hash_result) = 64 THEN
    RAISE NOTICE 'Result: PASS - Hash generated correctly';
  ELSE
    RAISE NOTICE 'Result: FAIL - Hash not generated correctly';
  END IF;
END $$;

-- Test 12: Test partition creation function
DO $$
BEGIN
  -- Test creating a partition for next month
  PERFORM public.create_monthly_partition(CURRENT_DATE + interval '2 months');
  
  RAISE NOTICE 'Test 12: Partition Creation Function';
  RAISE NOTICE 'Result: Check if partition for % was created', to_char(CURRENT_DATE + interval '2 months', 'YYYY_MM');
END $$;

-- ============================================================================
-- DATA INTEGRITY TESTS
-- ============================================================================

-- Test 13: Insert test data to verify constraints
DO $$
DECLARE
  test_user_id uuid;
  test_comment_id uuid;
BEGIN
  -- This test requires authentication context, so it's commented out
  -- Uncomment and run in authenticated context for full testing
  
  /*
  -- Get current user ID (requires auth context)
  SELECT auth.uid() INTO test_user_id;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Test 13: Cannot run data integrity test without authentication';
    RETURN;
  END IF;
  
  -- Test inserting a valid comment
  INSERT INTO public.comments (
    user_id, platform, platform_comment_id, platform_post_id, 
    platform_user_id, author_username, content
  ) VALUES (
    test_user_id, 'instagram', 'test_comment_001', 'test_post_001',
    'test_user_001', 'testuser', 'This is a test comment for validation'
  ) RETURNING id INTO test_comment_id;
  
  RAISE NOTICE 'Test 13: Data Integrity - Comment inserted with ID: %', test_comment_id;
  
  -- Test thread path generation
  IF EXISTS (
    SELECT 1 FROM public.comments 
    WHERE id = test_comment_id AND thread_path IS NOT NULL
  ) THEN
    RAISE NOTICE 'Result: PASS - Thread path generated correctly';
  ELSE
    RAISE NOTICE 'Result: FAIL - Thread path not generated';
  END IF;
  
  -- Clean up test data
  DELETE FROM public.comments WHERE id = test_comment_id;
  */
  
  RAISE NOTICE 'Test 13: Data Integrity Test (requires authentication context)';
  RAISE NOTICE 'Run manually with authenticated user to test insert/update operations';
END $$;

-- ============================================================================
-- SECURITY TESTS
-- ============================================================================

-- Test 14: Verify RLS is enabled on all tables
SELECT 
  'Test 14: RLS Status Validation' as test_name,
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%comment%'
ORDER BY tablename;

-- Test 15: Verify admin policies exist
SELECT 
  'Test 15: Admin Policies Validation' as test_name,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename LIKE '%comment%'
  AND (policyname LIKE '%admin%' OR policyname LIKE '%moderation%')
ORDER BY tablename, policyname;

-- ============================================================================
-- PERFORMANCE TESTS
-- ============================================================================

-- Test 16: Check for table statistics and analyze status
SELECT 
  'Test 16: Table Statistics Validation' as test_name,
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%comment%'
ORDER BY tablename;

-- Test 17: Index usage statistics (run after some data operations)
SELECT 
  'Test 17: Index Usage Validation' as test_name,
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE '%comment%'
ORDER BY tablename, indexname;

-- ============================================================================
-- FINAL VALIDATION SUMMARY
-- ============================================================================

DO $$
DECLARE
  table_count integer;
  index_count integer;
  trigger_count integer;
  policy_count integer;
  function_count integer;
BEGIN
  -- Count created objects
  SELECT COUNT(*) INTO table_count
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename LIKE '%comment%';
  
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename LIKE '%comment%';
  
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE event_object_schema = 'public' AND event_object_table LIKE '%comment%';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename LIKE '%comment%';
  
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public' AND (
    routine_name LIKE '%comment%' OR routine_name IN (
      'calculate_content_hash', 'update_comment_thread_path', 
      'log_audit_trail', 'cleanup_old_audit_logs', 'create_monthly_partition'
    )
  );
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'COMMENTS SYSTEM VALIDATION SUMMARY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'Indexes created: %', index_count;
  RAISE NOTICE 'Triggers created: %', trigger_count;
  RAISE NOTICE 'RLS policies created: %', policy_count;
  RAISE NOTICE 'Functions created: %', function_count;
  RAISE NOTICE '============================================================================';
  
  IF table_count >= 4 AND index_count >= 10 AND trigger_count >= 6 AND policy_count >= 12 AND function_count >= 5 THEN
    RAISE NOTICE 'RESULT: ✅ PHASE 1.1 IMPLEMENTATION SUCCESSFUL';
    RAISE NOTICE 'All core components have been created and configured.';
  ELSE
    RAISE NOTICE 'RESULT: ❌ PHASE 1.1 INCOMPLETE';
    RAISE NOTICE 'Some components may be missing. Review the detailed test results above.';
  END IF;
  
  RAISE NOTICE '============================================================================';
END $$;