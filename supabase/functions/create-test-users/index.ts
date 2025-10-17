import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const testAccounts = [
      // Providers
      { email: 'provider1@bloom.test', password: 'TestPass123!', role: 'provider', userId: '11111111-1111-1111-1111-111111111111' },
      { email: 'provider2@bloom.test', password: 'TestPass123!', role: 'provider', userId: '22222222-2222-2222-2222-222222222222' },
      { email: 'provider3@bloom.test', password: 'TestPass123!', role: 'provider', userId: '33333333-3333-3333-3333-333333333333' },
      // Seekers
      { email: 'seeker1@bloom.test', password: 'TestPass123!', role: 'seeker', userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      { email: 'seeker2@bloom.test', password: 'TestPass123!', role: 'seeker', userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
      { email: 'seeker3@bloom.test', password: 'TestPass123!', role: 'seeker', userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      { email: 'seeker4@bloom.test', password: 'TestPass123!', role: 'seeker', userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
      { email: 'seeker5@bloom.test', password: 'TestPass123!', role: 'seeker', userId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' },
    ];

    const results = [];

    for (const account of testAccounts) {
      console.log(`Checking user: ${account.email}`);
      
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUsers.users.some(u => u.email === account.email);
      
      if (userExists) {
        console.log(`⏭️ User already exists: ${account.email}`);
        results.push({ email: account.email, status: 'already_exists', message: 'User already exists' });
        continue;
      }
      
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          email: account.email
        }
      });

      if (authError) {
        console.error(`Error creating ${account.email}:`, authError);
        results.push({ email: account.email, status: 'error', error: authError.message });
        continue;
      }

      console.log(`✅ Created auth user: ${account.email}`);
      results.push({ email: account.email, status: 'success', userId: authData.user.id });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Created ${results.filter(r => r.status === 'success').length} test accounts`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-test-users:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});