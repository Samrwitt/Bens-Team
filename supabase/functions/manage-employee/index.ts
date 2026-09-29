import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return response({ error: 'Sign in required' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Never trust client-supplied roles or decode an unverified JWT.
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user) return response({ error: 'Sign in required' }, 401);
    const { data: profile, error: profileError } = await admin.from('employees').select('role').eq('auth_user_id', user.id).single();
    if (profileError || profile?.role !== 'manager') return response({ error: 'Manager access required' }, 403);
    const body = await req.json();
    if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) {
      return response({ error: 'Use a password between 10 and 128 characters.' }, 400);
    }
    if (body.action === 'reset-password') {
      const { data: employee, error } = await admin.from('employees').select('auth_user_id').eq('id', body.id).eq('role', 'employee').single();
      if (error || !employee) return response({ error: 'Employee not found' }, 404);
      const result = await admin.auth.admin.updateUserById(employee.auth_user_id, { password: body.password });
      if (result.error) return response({ error: result.error.message }, 400);
      return response({ ok: true });
    }
    if (body.action !== 'create') return response({ error: 'Unknown action' }, 400);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!name || name.length > 200 || !email.includes('@')) return response({ error: 'Enter a valid name and email.' }, 400);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password: body.password, email_confirm: true,
    });
    if (createError || !created.user) return response({ error: createError?.message || 'Account creation failed' }, 400);
    const { error: insertError } = await admin.from('employees').insert({ auth_user_id: created.user.id, name, email, role: 'employee' });
    if (insertError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
      if (cleanupError) console.error('Account cleanup required for auth user', created.user.id);
      return response({ error: 'Employee profile could not be saved. Check Auth users before retrying.' }, 409);
    }
    return response({ ok: true });
  } catch {
    return response({ error: 'Unable to process the request.' }, 400);
  }
});
