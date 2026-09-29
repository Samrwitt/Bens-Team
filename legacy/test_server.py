import unittest, tempfile, threading, json, urllib.request, urllib.error, http.cookiejar
from pathlib import Path
import server

class ManagerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(); server.DB=str(Path(cls.temp.name)/'test.sqlite3'); server.MANAGER_PASSWORD='test-manager-password'; server.initialize()
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        threading.Thread(target=cls.http.serve_forever,daemon=True).start(); cls.url='http://127.0.0.1:'+str(cls.http.server_port)
    @classmethod
    def tearDownClass(cls): cls.http.shutdown(); cls.http.server_close(); cls.temp.cleanup()
    def client(self): return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(self,client,path,data=None):
        request=urllib.request.Request(self.url+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'})
        try:
            with client.open(request) as r: return r.status,json.load(r)
        except urllib.error.HTTPError as e: return e.code,json.load(e)
    def test_full_workflow_and_security(self):
        c=self.client(); self.assertEqual(self.call(c,'data')[0],401)
        self.assertEqual(self.call(c,'login',{'password':'wrong'})[0],401)
        self.assertEqual(self.call(c,'login',{'password':server.MANAGER_PASSWORD})[0],200)
        self.assertEqual(self.call(c,'employees',{'name':'Test Employee','email':'test@example.com','password':'long-password'})[0],200)
        self.assertEqual(self.call(c,'employees',{'name':'Duplicate','email':'test@example.com','password':'long-password'})[0],400)
        self.assertEqual(self.call(c,'teams',{'name':'Design','members':[1]})[0],200)
        for title in ['First assignment','Second assignment']:
            self.assertEqual(self.call(c,'assignments',{'title':title,'description':'A useful brief','owner':'team:1','due':'2026-10-01'})[0],200)
        self.assertEqual(self.call(c,'feedback',{'assignment_id':1,'body':'Initial feedback'})[0],200)
        self.assertEqual(self.call(c,'feedback',{'assignment_id':1,'parent_id':1,'body':'A reply'})[0],200)
        self.assertEqual(self.call(c,'feedback',{'assignment_id':1,'parent_id':2,'body':'Reply to reply'})[0],200)
        self.assertEqual(self.call(c,'feedback',{'assignment_id':2,'parent_id':1,'body':'Wrong assignment'})[0],400)
        self.assertEqual(self.call(c,'status',{'id':1,'status':'Done'})[0],200)
        self.assertEqual(self.call(c,'status',{'id':1,'status':'Invalid'})[0],400)
        self.assertEqual(self.call(c,'password',{'id':1,'password':'changed-password'})[0],200)
        self.assertEqual(self.call(c,'teams',{'id':1,'name':'Updated team','members':[]})[0],200)
        _,d=self.call(c,'data'); self.assertEqual(len(d['feedback']),3); self.assertEqual(d['assignments'][0]['status'],'Done'); self.assertNotIn('password',d['employees'][0]); self.assertEqual(d['members'],[])
        server.initialize()
        with server.connect() as db:
            stored=db.execute('SELECT password FROM employees WHERE id=1').fetchone()[0]
            self.assertNotEqual(stored,'changed-password'); self.assertEqual(server.password_hash('changed-password',stored.split(':')[0]),stored)
            self.assertEqual(db.execute('SELECT count(*) FROM assignments').fetchone()[0],2)
        self.assertEqual(self.call(c,'logout',{})[0],200); self.assertEqual(self.call(c,'data')[0],401)

if __name__=='__main__': unittest.main()
