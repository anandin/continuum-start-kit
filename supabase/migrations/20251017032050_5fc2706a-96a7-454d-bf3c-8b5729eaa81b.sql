-- ============================================
-- TEST DATA SETUP - Part 1: Users and Roles
-- 3 Providers + 5 Seekers
-- Password for ALL accounts: TestPass123!
-- ============================================

-- PROVIDERS
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'provider1@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"provider1@bloom.test","email_verified":true}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'provider2@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"provider2@bloom.test","email_verified":true}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'provider3@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"provider3@bloom.test","email_verified":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- SEEKERS  
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'seeker1@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"seeker1@bloom.test","email_verified":true}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'seeker2@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"seeker2@bloom.test","email_verified":true}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'seeker3@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"seeker3@bloom.test","email_verified":true}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'seeker4@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"seeker4@bloom.test","email_verified":true}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'seeker5@bloom.test', crypt('TestPass123!', gen_salt('bf')), now(), now(), now(), '{"email":"seeker5@bloom.test","email_verified":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Profiles
INSERT INTO profiles (id, email, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'provider1@bloom.test', now()),
  ('22222222-2222-2222-2222-222222222222', 'provider2@bloom.test', now()),
  ('33333333-3333-3333-3333-333333333333', 'provider3@bloom.test', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'seeker1@bloom.test', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'seeker2@bloom.test', now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'seeker3@bloom.test', now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'seeker4@bloom.test', now()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'seeker5@bloom.test', now())
ON CONFLICT (id) DO NOTHING;

-- Roles
INSERT INTO user_roles (user_id, role, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'provider', now()),
  ('22222222-2222-2222-2222-222222222222', 'provider', now()),
  ('33333333-3333-3333-3333-333333333333', 'provider', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'seeker', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'seeker', now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'seeker', now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'seeker', now()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'seeker', now())
ON CONFLICT (user_id) DO NOTHING;

-- Seekers
INSERT INTO seekers (id, owner_id, created_at)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now()),
  ('b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now()),
  ('c3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now()),
  ('d4444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', now()),
  ('e5555555-5555-5555-5555-555555555555', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', now())
ON CONFLICT (id) DO NOTHING;