import { createClient } from '@supabase/supabase-js';

// Read variables with fallbacks for Vite, Next, and default Vercel integrations
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  import.meta.env.SUPABASE_URL || 
  'https://hrunvelvuqtiqlvlwuwx.supabase.co';

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydW52ZWx2dXF0aXFsd2x3dXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNzgwMzIsImV4cCI6MjA1Njg1NDAzMn0.J8N_2fQ4O1pY0W_m2R7P';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
