import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url).pathname;
const url='https://bens-workroom.vercel.app';
const accounts=[{role:'manager',email:'ben@example.com',password:process.env.WORKROOM_MANAGER_PASSWORD},{role:'employee',email:'samrawit@example.com',password:process.env.WORKROOM_EMPLOYEE_PASSWORD}];
if(accounts.some(account=>!account.password))throw new Error('Set WORKROOM_MANAGER_PASSWORD and WORKROOM_EMPLOYEE_PASSWORD. Credentials are never saved.');
const images=[],errors=[];
if (process.env.WORKROOM_CAPTURE_EMPLOYEE_ONLY) {
 const managerPages=[['01-sign-in.png','Live sign-in'],['13-live-sign-in.png','Live production sign-in'],['02-assignments.png','Manager assignments'],['03-new-assignment.png','New assignment form'],['06-employees.png','Employees'],['07-add-employee.png','Add employee form'],['08-reset-password.png','Reset employee password form'],['09-teams.png','Teams'],['10-create-team.png','Create team form'],['11-edit-team.png','Edit team form'],['04-assignment-feedback.png','Manager assignment and feedback'],['05-reply.png','Reply to a message'],['section-2/manager-ai-empty.png','AI chat · new conversation'],['section-2/manager-analysis.png','AI chat · live assignment response'],['section-2/attachment-fullscreen.png','Live attachment viewer'],['12-mobile-assignment.png','Manager assignment · mobile']];
 images.push(...managerPages.map(([path,title])=>({path,title})));
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
async function capture(page,path,title){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:root+'previews/'+path,fullPage:!(await page.locator('dialog[open]').count()),animations:'disabled'});images.push({path,title});console.log(`Saved ${path}`);}
async function closeModal(page){const close=page.getByRole('button',{name:'Close',exact:true});if(await close.count())await close.click();else await page.getByRole('button',{name:'Cancel',exact:true}).click();}
async function detail(page){const row=page.locator('[data-assignment]').first();if(!await row.count())return false;await row.locator('td').first().click();await page.getByRole('heading',{name:'Assignment brief'}).waitFor();await page.locator('.attachment-preview p').filter({hasText:/Loading/}).first().waitFor({state:'hidden',timeout:15000}).catch(()=>{});return true;}
try{
 await mkdir(root+'previews/section-2',{recursive:true});
 for(const account of accounts.filter(account=>!process.env.WORKROOM_CAPTURE_EMPLOYEE_ONLY || account.role === "employee")){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.getByRole('button',{name:'Sign in'}).waitFor();
  if(account.role==='manager'){await capture(page,'01-sign-in.png','Live sign-in');await capture(page,'13-live-sign-in.png','Live production sign-in');}
  await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in'}).click();
  const heading=page.getByRole('heading',{name:account.role==='manager'?'Assignments':'My assignments',exact:true});
  try{await heading.waitFor({timeout:30000});}catch{const error=await page.locator('.error').allTextContents();throw new Error(`${account.role} sign-in failed: ${error.join(' ')}`);}
  console.log(`Signed in to ${account.role} workspace.`);
  if(account.role==='manager'){
   await capture(page,'02-assignments.png','Manager assignments');
   await page.getByRole('button',{name:'New assignment'}).click();await capture(page,'03-new-assignment.png','New assignment form');await closeModal(page);
   await page.getByRole('link',{name:'Employees'}).click();await capture(page,'06-employees.png','Employees');
   await page.getByRole('button',{name:'Add employee'}).click();await capture(page,'07-add-employee.png','Add employee form');await closeModal(page);
   if(await page.getByRole('button',{name:'Reset password',exact:true}).count()){await page.getByRole('button',{name:'Reset password',exact:true}).first().click();await capture(page,'08-reset-password.png','Reset employee password form');await closeModal(page);}
   await page.getByRole('link',{name:'Teams'}).click();await capture(page,'09-teams.png','Teams');await page.getByRole('button',{name:'Create team'}).click();await capture(page,'10-create-team.png','Create team form');await closeModal(page);
   if(await page.getByRole('button',{name:'Edit team'}).count()){await page.getByRole('button',{name:'Edit team'}).first().click();await capture(page,'11-edit-team.png','Edit team form');await closeModal(page);}
   await page.getByRole('link',{name:'Assignments'}).click();
   if(await detail(page)){
    await capture(page,'04-assignment-feedback.png','Manager assignment and feedback');
    if(await page.locator('.message-content').count()){await page.locator('.message-content').last().click();await page.getByRole('button',{name:'Reply',exact:false}).click();await capture(page,'05-reply.png','Reply to a message');await page.getByRole('button',{name:'Cancel reply'}).click();}
    await page.getByRole('button',{name:'Ask AI',exact:true}).click();await capture(page,'section-2/manager-ai-empty.png','AI chat · new conversation');
    await page.getByLabel('Your question').fill('What seems to be the progress on this assignment?');await page.getByLabel('Your question').press('Enter');
    await page.locator('.ai-thinking').waitFor({state:'detached',timeout:65000});
    await capture(page,'section-2/manager-analysis.png','AI chat · live assignment response');await closeModal(page);
    if(await page.locator('.image-thumbnail:not([hidden])').count()){await page.locator('.image-thumbnail:not([hidden])').first().click();await capture(page,'section-2/attachment-fullscreen.png','Live attachment viewer');await page.getByRole('button',{name:'Close image'}).click();}
    await page.setViewportSize({width:390,height:844});await capture(page,'12-mobile-assignment.png','Manager assignment · mobile');
   }
  }else{
   await capture(page,'section-2/employee-assignments.png','Employee assignments');
   if(await detail(page)){
    await capture(page,'section-2/employee-detail.png','Employee assignment and feedback');
    if(await page.locator('.message-content').count()){await page.locator('.message-content').last().click();await page.getByRole('button',{name:'Reply',exact:false}).click();await capture(page,'section-2/employee-reply.png','Employee reply composer');await page.getByRole('button',{name:'Cancel reply'}).click();}
    if(await page.locator('.attachment-processing').count())await capture(page,'section-2/attachment-processing.png','Actual attachment analysis status');
    await page.setViewportSize({width:390,height:844});await capture(page,'section-2/employee-mobile.png','Employee assignment · mobile');
   }
  }
  await context.close();
 }
 const style='body{font:16px system-ui;background:#f7f8fa;color:#202b36;margin:32px}main{max-width:1200px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article{background:white;padding:16px;border:1px solid #dde4e0;border-radius:12px}img{width:100%;height:260px;object-fit:contain;object-position:top;background:#f7f8fa}a{color:#176b58}p{color:#63707c}';
 const gallery=(list,section=false)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workroom live previews</title><style>${style}</style></head><body><main><h1>${section?'Employee portal and AI':'Workroom · live production pages'}</h1><p>Captured ${new Date().toISOString().slice(0,10)} from <a href="${url}">${url}</a>, signed in to the actual manager and employee accounts. Screens show existing workspace data and a real AI response. Forms were opened without saving changes; no feedback was posted.</p><p><a href="${section?'../index.html':'section-2/index.html'}">${section?'All pages':'Employee portal and AI previews'}</a> · <a href="${section?'../sample-data/index.html':'sample-data/index.html'}">Earlier sample-data previews</a></p><div class="grid">${list.map(item=>{const path=section?item.path.replace('section-2/',''):item.path;return `<article><h2>${item.title}</h2><p>Live production capture</p><a href="${path}"><img src="${path}" alt="${item.title}" loading="lazy"></a></article>`;}).join('')}</div></main></body></html>`;
 await writeFile(root+'previews/index.html',gallery(images));await writeFile(root+'previews/section-2/index.html',gallery(images.filter(item=>item.path.startsWith('section-2/')),true));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`Captured ${images.length} live screenshots and updated both galleries.`);
}finally{await browser.close();}
