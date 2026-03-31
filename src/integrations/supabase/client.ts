import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ixdksvkdjfypxbkdmplz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZGtzdmtkamZ5cHhia2RtcGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzE2NTYsImV4cCI6MjA5MDU0NzY1Nn0.17fAptwfCJ601Bv1Qsel2V0O432IF2wVG15Oqx4JTLg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
