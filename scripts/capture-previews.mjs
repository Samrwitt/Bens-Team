import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url).pathname;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5181','--strictPort'], {
  cwd:root, env:{...process.env,VITE_SUPABASE_URL:'https://workroom-preview.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_preview'},stdio:'pipe',
});
let browser;
const errors=[];
const manager={id:1,auth_user_id:'00000000-0000-0000-0000-000000000001',name:'Ben Carter',email:'ben@example.com',role:'manager'};
const people=[manager,{id:2,auth_user_id:'00000000-0000-0000-0000-000000000002',name:'Samrawit Tesfaye',email:'samrawit@example.com',role:'employee'},{id:3,auth_user_id:'00000000-0000-0000-0000-000000000003',name:'Alex Morgan',email:'alex@example.com',role:'employee'}];
const assignments=[{id:1,title:'Build the employee portal',description:'Keep the employee portal simple. Employees should see their assigned work, read manager feedback, and post updates or upload files under the same assignment ID.',employee_id:2,team_id:null,due:'2026-10-09',status:'In progress'},{id:2,title:'Prepare the onboarding guide',description:'Write a short guide for new employees.',employee_id:null,team_id:1,due:'2026-10-13',status:'Open'},{id:3,title:'Review the sign-in flow',description:'Check manager and employee sign-in.',employee_id:3,team_id:null,due:'2026-10-02',status:'Done'}];
const initialFeedback=[{id:1,assignment_id:1,parent_id:null,author_id:manager.auth_user_id,body:'Please keep the portal centered on assignments. Employees should only see their own work and feedback.',created:'2026-10-05T07:00:00Z'},{id:2,assignment_id:1,parent_id:1,author_id:people[1].auth_user_id,body:'Section 1 is complete. I have attached the team creation screen for review.',created:'2026-10-05T07:30:00Z'},{id:3,assignment_id:1,parent_id:2,author_id:manager.auth_user_id,body:'This is clean and clear. Please share what remains for the employee portal.',created:'2026-10-05T08:00:00Z'}];
const attachments=[{id:1,feedback_id:2,name:'team-creation.png',path:'sample/team-creation.png',content_type:'image/png',size:48000},{id:2,feedback_id:2,name:'portal-checklist.pdf',path:'sample/portal-checklist.pdf',content_type:'application/pdf',size:32000}];
const gallery=[];
async function capture(page,path,title,kind='Sample data · current application') {
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:root+'previews/'+path,fullPage: !(await page.locator("dialog[open]").count()),animations:'disabled'});
  gallery.push({path,title,kind});
  console.log(`Saved ${path}`);
}
async function setup(role) {
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const profile=role==='manager'?manager:people[1];const user={id:profile.auth_user_id,email:profile.email,aud:'authenticated',role:'authenticated'};
 const feedback=structuredClone(initialFeedback);const reads=[];
 const processing=[{attachment_id:1,status:'ready',error:null},{attachment_id:2,status:'ready',error:null}];
 await page.route('https://workroom-preview.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url());let data=[];
  if(url.pathname==='/auth/v1/token') data={access_token:'preview-session-token',refresh_token:'preview-refresh-token',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user') data=user;
  else if(url.pathname==='/rest/v1/employees') data=url.searchParams.has('auth_user_id')?profile:role==='manager'?people:[profile];
  else if(url.pathname==='/rest/v1/assignments') data=role==='manager'?assignments:assignments.filter(a=>a.employee_id===2||a.team_id===1);
  else if(url.pathname==='/rest/v1/teams') data=[{id:1,name:'Product team'}];
  else if(url.pathname==='/rest/v1/members') data=[{team_id:1,employee_id:2},{team_id:1,employee_id:3}];
  else if(url.pathname==='/rest/v1/feedback') data=feedback;
  else if(url.pathname==='/rest/v1/feedback_attachments') data=attachments;
  else if(url.pathname==='/rest/v1/attachment_processing') data=processing;
  else if(url.pathname==='/rest/v1/feedback_reads') {if(request.method()==='POST'){reads.push(...request.postDataJSON());data=null;}else data=reads;}
  else if(url.pathname==='/rest/v1/rpc/feedback_authors') data=people.map(({auth_user_id,name})=>({auth_user_id,name}));
  else if(url.pathname==='/functions/v1/analyze-assignment') data={configured:true,assignment_id:1,answer:'Section 1 is confirmed complete. The employee portal is still in progress, and the remaining work has not been confirmed yet.',suggested_feedback:'Could you share the progress on the remaining employee portal work and what is left to finish?',attachment_status:{ready:2,pending:0,failed:0}};
  else if(url.pathname==='/rest/v1/rpc/post_feedback') {const input=request.postDataJSON();feedback.push({id:feedback.length+1,assignment_id:input.target_assignment,parent_id:input.reply_to,author_id:user.id,body:input.feedback_body,created:'2026-10-05T08:30:00Z'});data=feedback.length;}
  else if(url.pathname.startsWith('/storage/v1/object/sign/')&&request.method()==='POST') data={signedURL:'/object/sign/feedback-files/team-creation.png?token=sample'};
  else if(url.pathname==='/storage/v1/object/sign/feedback-files/team-creation.png') {await route.fulfill({contentType:'image/png',body:await readFile(root+'previews/10-create-team.png')});return;}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5181');
 await page.getByRole('button',{name:'Sign in'}).waitFor();
 return {page,processing,async login(){await page.getByLabel('Email',{exact:true}).fill(profile.email);await page.getByLabel('Password',{exact:true}).fill('sample-password');await page.getByRole('button',{name:'Sign in'}).click();await page.getByRole('heading',{name:role==='manager'?'Assignments':'My assignments',exact:true}).waitFor();}};
}
try {
 await mkdir(root+'previews/section-2',{recursive:true});
 for(let attempt=0;attempt<50;attempt++){try{if((await fetch('http://127.0.0.1:5181')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));if(attempt===49)throw new Error('Preview server unavailable');}
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const managerView=await setup('manager');const page=managerView.page;
 await capture(page,'01-sign-in.png','Sign in');await managerView.login();
 await capture(page,'02-assignments.png','Manager assignments');
 await page.getByRole('button',{name:'New assignment'}).click();
 await page.getByLabel('Assignment title').fill('Build assignment analysis');await page.getByLabel('Brief',{exact:true}).fill('Analyze the selected assignment, feedback, and processed attachments. Keep the chat simple.');await page.getByLabel('Assign to',{exact:true}).selectOption('team:1');await page.getByLabel('Due date').fill('2026-10-16');
 await capture(page,'03-new-assignment.png','New assignment');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('link',{name:'Employees'}).click();await capture(page,'06-employees.png','Employees');
 await page.getByRole('button',{name:'Add employee'}).click();await page.getByLabel('Full name').fill('Jordan Lee');await page.getByLabel('Email',{exact:true}).fill('jordan@example.com');await capture(page,'07-add-employee.png','Add employee');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Reset password',exact:true}).first().click();await capture(page,'08-reset-password.png','Reset employee password');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('link',{name:'Teams'}).click();await capture(page,'09-teams.png','Teams');
 await page.getByRole('button',{name:'Create team'}).click();await page.getByLabel('Team name').fill('Delivery team');await page.getByLabel('Samrawit Tesfaye',{exact:true}).check();await capture(page,'10-create-team.png','Create team');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Edit team'}).click();await capture(page,'11-edit-team.png','Edit team');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('link',{name:'Assignments'}).click();await page.getByText('Build the employee portal',{exact:true}).click();await page.getByRole('img',{name:'team-creation.png',exact:true}).waitFor();
 await capture(page,'04-assignment-feedback.png','Assignment and feedback');
 await page.locator('[data-message="2"] .message-content').click();await page.getByRole('button',{name:'Reply',exact:false}).click();await page.getByLabel('Your reply').fill('Thanks. Please share the remaining work when you have an update.');await capture(page,'05-reply.png','Reply to a specific message');await page.getByRole('button',{name:'Cancel reply'}).click();await page.getByLabel('Add feedback').fill('');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();await capture(page,'section-2/manager-ai-empty.png','AI chat · new conversation');
 await page.getByLabel('Your question').fill('What is the progress on this assignment?');await page.getByLabel('Your question').press('Enter');await page.getByLabel('Suggested feedback question').waitFor();await page.locator('.ai-thinking').waitFor({state:'detached'});
 await capture(page,'section-2/manager-analysis.png','AI chat · assignment analysis');
 await page.getByRole('button',{name:'Send to feedback',exact:true}).click();await page.getByText('Your question has been posted to feedback.',{exact:true}).waitFor();await capture(page,'section-2/manager-ai-sent.png','AI chat · suggested question sent');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Enlarge team-creation.png'}).click();await capture(page,'section-2/attachment-fullscreen.png','Attachment viewer');await page.getByRole('button',{name:'Close image'}).click();
 await page.setViewportSize({width:390,height:844});await capture(page,'12-mobile-assignment.png','Manager assignment · mobile');
 const employeeView=await setup('employee');await employeeView.login();const employee=employeeView.page;await capture(employee,'section-2/employee-assignments.png','Employee assignments');await employee.getByText('Build the employee portal',{exact:true}).click();await employee.getByRole('img',{name:'team-creation.png',exact:true}).waitFor();await capture(employee,'section-2/employee-detail.png','Employee assignment and feedback');
 await employee.locator('[data-message="3"] .message-content').click();await employee.getByRole('button',{name:'Reply',exact:false}).click();await employee.getByLabel('Your reply').fill('The assigned work is progressing. I will share the remaining checklist here.');await capture(employee,'section-2/employee-reply.png','Employee reply');await employee.getByRole('button',{name:'Cancel reply'}).click();await employee.getByLabel('Add feedback').fill('');
 employeeView.processing[1].status='queued';await employee.reload();await employee.getByText('Processing for AI…',{exact:true}).waitFor();await capture(employee,'section-2/attachment-processing.png','Attachment processing status');
 await employee.setViewportSize({width:390,height:844});await capture(employee,'section-2/employee-mobile.png','Employee assignment · mobile');
 const live=await browser.newPage({viewport:{width:1440,height:1000}});await live.goto('https://bens-workroom.vercel.app');await live.getByRole('button',{name:'Sign in'}).waitFor();await capture(live,'13-live-sign-in.png','Live production sign-in','Live production · signed out');
 const style='body{font:16px system-ui;background:#f7f8fa;color:#202b36;margin:32px}main{max-width:1200px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article{background:white;padding:16px;border:1px solid #dde4e0;border-radius:12px}img{width:100%;height:260px;object-fit:contain;object-position:top;background:#f7f8fa}a{color:#176b58}p{color:#63707c}';
 function galleryHtml(items,section=false){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workroom previews</title><style>${style}</style></head><body><main><h1>${section?'Employee portal and AI':'Workroom · current UI'}</h1><p>Captured ${new Date().toISOString().slice(0,10)} from the current application. Workspace screens use sample accounts, assignments, files, and AI responses; the live sign-in image is labeled separately. Click a picture for full size.</p><p><a href="${section?'../index.html':'section-2/index.html'}">${section?'All pages':'Employee portal and AI previews'}</a></p><div class="grid">${items.map(item=>{const path=section?item.path.replace('section-2/',''):item.path;return `<article><h2>${item.title}</h2><p>${item.kind}</p><a href="${path}"><img src="${path}" alt="${item.title}" loading="lazy"></a></article>`;}).join('')}</div></main></body></html>`;}
 await writeFile(root+'previews/index.html',galleryHtml(gallery));await writeFile(root+'previews/section-2/index.html',galleryHtml(gallery.filter(item=>item.path.startsWith('section-2/')),true));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`Captured ${gallery.length} current screenshots and refreshed both galleries.`);
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
