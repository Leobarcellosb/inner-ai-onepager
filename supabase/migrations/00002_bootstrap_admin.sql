-- ════════════════════════════════════════════════════════════════════════
-- Bootstrap: Give admin role to the first user who signs up
-- Run AFTER creating your first account via the login page
-- Replace YOUR_USER_ID with your actual UUID from auth.users
-- ════════════════════════════════════════════════════════════════════════

-- Option 1: Manual (replace the UUID)
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('YOUR_USER_ID_HERE', 'admin');

-- Option 2: Auto-promote the first user (run once, then delete)
-- This gives admin role to the earliest-created user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;
