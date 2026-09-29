import os, json, sqlite3, hashlib, secrets, time, argparse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from pathlib import Path

ROOT = Path(__file__).parent
DB = os.environ.get('TASK_DB', str(ROOT / 'tasks.sqlite3'))
SESSIONS = {}
PUBLIC_ORIGIN = os.environ.get('PUBLIC_ORIGIN', '').rstrip('/')

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()

def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db

def initialize(demo=False):
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS employees(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS teams(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
        CREATE TABLE IF NOT EXISTS members(team_id INTEGER REFERENCES teams(id), employee_id INTEGER REFERENCES employees(id), PRIMARY KEY(team_id,employee_id));
        CREATE TABLE IF NOT EXISTS assignments(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL, employee_id INTEGER REFERENCES employees(id), team_id INTEGER REFERENCES teams(id), due TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open', CHECK ((employee_id IS NOT NULL) != (team_id IS NOT NULL)));
        CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id), parent_id INTEGER REFERENCES feedback(id), body TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        ''')
        if demo and not db.execute('SELECT 1 FROM employees').fetchone():
            for name, email in [('Maya Chen','maya@example.com'),('Daniel Brooks','daniel@example.com'),('Sofia Ahmed','sofia@example.com')]:
                db.execute('INSERT INTO employees(name,email,password) VALUES(?,?,?)',(name,email,password_hash(secrets.token_urlsafe(24))))
            db.executemany('INSERT INTO teams(name) VALUES(?)',[('Design',),('Operations',)])
            db.executemany('INSERT INTO members VALUES(?,?)',[(1,1),(1,3),(2,2)])
            db.executemany('INSERT INTO assignments(title,description,employee_id,team_id,due,status) VALUES(?,?,?,?,?,?)',[
                ('Refresh the customer welcome guide','Review the current welcome guide and prepare a clearer, shorter version. Include the first three steps a new customer should take. Share the draft for feedback before finalizing.',None,1,'2026-10-02','In progress'),
                ('Prepare the weekly operations report','Summarize this week’s progress, open issues, and next steps.',2,None,'2026-10-01','Open'),
                ('Review onboarding illustrations','Check the illustrations for consistency and readability.',1,None,'2026-10-05','Done')])
            db.execute('INSERT INTO feedback(assignment_id,body) VALUES(1,?)',('Please keep the introduction to one page and make the next steps easy to scan.',))
            db.execute('INSERT INTO feedback(assignment_id,parent_id,body) VALUES(1,1,?)',('One more detail: use the updated support email in the final section.',))

class Handler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        body=json.dumps(data).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def authorized(self):
        cookie=SimpleCookie(); cookie.load(self.headers.get('Cookie',''))
        token=cookie.get('session'); return token and SESSIONS.get(token.value,0)>time.time()
    def do_GET(self):
        if self.path=='/api/data':
            if not self.authorized(): return self.send_json({'error':'Please sign in.'},401)
            with connect() as db:
                data={table:[dict(r) for r in db.execute('SELECT '+('id,name,email' if table=='employees' else '*')+' FROM '+table)] for table in ['employees','teams','members','assignments','feedback']}
            return self.send_json(data)
        path=self.path.split('?')[0]
        file=ROOT/'static'/({'/':'index.html'}.get(path,path.lstrip('/')))
        if file.parent != ROOT/'static' or not file.is_file(): return self.send_json({'error':'Not found'},404)
        self.send_response(200); self.send_header('Content-Type',{'html':'text/html','css':'text/css','js':'text/javascript'}.get(file.suffix[1:],'text/plain')); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(file.read_bytes())
    def do_POST(self):
        try:
            # Require same-origin JSON requests, including login.
            origin=self.headers.get('Origin')
            if origin and origin != (PUBLIC_ORIGIN or 'http://'+self.headers.get('Host','')): return self.send_json({'error':'Invalid origin'},403)
            if self.headers.get('Content-Type','').split(';')[0]!='application/json': return self.send_json({'error':'JSON required'},415)
            length=int(self.headers.get('Content-Length',0))
            if length>65536: return self.send_json({'error':'Request too large'},413)
            data=json.loads(self.rfile.read(length))
            if self.path=='/api/login':
                if not secrets.compare_digest(str(data.get('password','')),MANAGER_PASSWORD): return self.send_json({'error':'Incorrect manager password.'},401)
                token=secrets.token_urlsafe(32); SESSIONS[token]=time.time()+28800
                self.send_response(200); self.send_header('Set-Cookie',f'session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+('; Secure' if PUBLIC_ORIGIN.startswith('https://') else '')); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(b'{}'); return
            if not self.authorized(): return self.send_json({'error':'Please sign in.'},401)
            if self.path=='/api/logout':
                cookie=SimpleCookie(); cookie.load(self.headers.get('Cookie','')); SESSIONS.pop(cookie['session'].value,None); return self.send_json({})
            def required(key):
                value=str(data.get(key,'')).strip()
                if not value or len(value)>10000: raise ValueError('Please complete all required fields.')
                return value
            with connect() as db:
                if self.path=='/api/employees':
                    password=required('password')
                    if len(password)<10: raise ValueError('Use a password with at least 10 characters.')
                    email=required('email').lower()
                    if '@' not in email: raise ValueError('Enter a valid email address.')
                    db.execute('INSERT INTO employees(name,email,password) VALUES(?,?,?)',(required('name'),email,password_hash(password)))
                elif self.path=='/api/password':
                    password=required('password')
                    if len(password)<10: raise ValueError('Use a password with at least 10 characters.')
                    if db.execute('UPDATE employees SET password=? WHERE id=?',(password_hash(password),int(data['id']))).rowcount!=1: raise ValueError('Employee not found.')
                elif self.path=='/api/teams':
                    team_id=data.get('id')
                    if team_id:
                        if db.execute('UPDATE teams SET name=? WHERE id=?',(required('name'),team_id)).rowcount!=1: raise ValueError('Team not found.')
                        db.execute('DELETE FROM members WHERE team_id=?',(team_id,))
                    else: team_id=db.execute('INSERT INTO teams(name) VALUES(?)',(required('name'),)).lastrowid
                    for employee_id in set(data.get('members',[])): db.execute('INSERT INTO members VALUES(?,?)',(team_id,int(employee_id)))
                elif self.path=='/api/assignments':
                    from datetime import date
                    due=required('due'); date.fromisoformat(due)
                    kind, identity=required('owner').split(':')
                    if kind not in ['employee','team']: raise ValueError('Select an employee or team.')
                    db.execute('INSERT INTO assignments(title,description,employee_id,team_id,due) VALUES(?,?,?,?,?)',(required('title'),required('description'),int(identity) if kind=='employee' else None,int(identity) if kind=='team' else None,due))
                elif self.path=='/api/status':
                    status=required('status')
                    if status not in ['Open','In progress','Done']: raise ValueError('Invalid status.')
                    if db.execute('UPDATE assignments SET status=? WHERE id=?',(status,int(data['id']))).rowcount!=1: raise ValueError('Assignment not found.')
                elif self.path=='/api/feedback':
                    assignment_id=int(data['assignment_id']); parent=data.get('parent_id')
                    if parent and not db.execute('SELECT 1 FROM feedback WHERE id=? AND assignment_id=?',(int(parent),assignment_id)).fetchone(): raise ValueError('Reply must belong to this assignment.')
                    db.execute('INSERT INTO feedback(assignment_id,parent_id,body) VALUES(?,?,?)',(assignment_id,parent,required('body')))
                else: return self.send_json({'error':'Not found'},404)
            self.send_json({'ok':True})
        except sqlite3.IntegrityError: self.send_json({'error':'That email or team name already exists, or the selected record is unavailable.'},400)
        except (ValueError,KeyError,TypeError): self.send_json({'error':'Check your fields. Passwords need 10 characters; all required fields must be filled.'},400)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--demo',action='store_true'); parser.add_argument('--port',type=int,default=8000); parser.add_argument('--host',default='127.0.0.1'); args=parser.parse_args()
    MANAGER_PASSWORD=os.environ.get('MANAGER_PASSWORD') or secrets.token_urlsafe(16)
    if 'MANAGER_PASSWORD' not in os.environ: print('Temporary manager password:',MANAGER_PASSWORD,flush=True)
    initialize(args.demo)
    print(f'Listening on http://{args.host}:{args.port}',flush=True)
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
