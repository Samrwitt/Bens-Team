import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes('YOUR_PROJECT'));
const client = configured ? createClient(url, key) : null;

async function result(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
async function allRows(table) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    let query = client.from(table).select('*').order(table === 'members' ? 'team_id' : 'id');
    if (table === 'members') query = query.order('employee_id');
    const page = await result(query.range(start, start + 499));
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
async function manageEmployee(body) {
  const { data, error } = await client.functions.invoke('manage-employee', { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (data.error) throw new Error(data.error);
  return data;
}
export async function api(path, body) {
  if (!client) throw new Error('Supabase is not configured.');
  if (path === 'login') return result(client.auth.signInWithPassword(body));
  if (path === 'logout') return result(client.auth.signOut());
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session) throw Object.assign(new Error('Please sign in.'), { code: 'SIGNED_OUT' });
  if (path === 'data') {
    const profile = await result(client.from('employees').select('*').eq('auth_user_id', session.user.id).maybeSingle());
    if (profile?.role !== 'manager') {
      await client.auth.signOut();
      throw Object.assign(new Error('This is the manager workspace. Your account does not have manager access.'), { code: 'MANAGER_REQUIRED' });
    }
    const tables = ['employees', 'teams', 'members', 'assignments', 'feedback'];
    const values = await Promise.all(tables.map(allRows));
    const data = Object.fromEntries(tables.map((table, i) => [table, values[i]]));
    data.people = data.employees;
    data.employees = data.people.filter(person => person.role === 'employee');
    return data;
  }
  if (path === 'employees') return manageEmployee({ ...body, action: 'create' });
  if (path === 'password') return manageEmployee({ ...body, action: 'reset-password' });
  if (path === 'teams') return result(client.rpc('save_team', { team_name: body.name, member_ids: body.members, target_id: body.id || null }));
  if (path === 'assignments') {
    const [kind, value] = body.owner.split(':');
    if (!['team', 'employee'].includes(kind) || !Number.isSafeInteger(Number(value))) throw new Error('Select an employee or team.');
    return result(client.from('assignments').insert({ title: body.title, description: body.description, due: body.due,
      employee_id: kind === 'employee' ? Number(value) : null, team_id: kind === 'team' ? Number(value) : null }));
  }
  if (path === 'status') return result(client.from('assignments').update({ status: body.status }).eq('id', body.id).select('id').single());
  if (path === 'feedback') return result(client.from('feedback').insert({ assignment_id: body.assignment_id, parent_id: body.parent_id || null, body: body.body, author_id: session.user.id }));
  throw new Error('Unknown action');
}
export function onSignedOut(callback) {
  if (client) client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') callback(); });
}
