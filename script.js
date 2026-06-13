(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const app = $('app'), canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;
  const courts = [
    { id:'driveway', name:'Driveway', cost:0, mult:1, icon:'🏡', ambience:0, bg:'#2c95d8' },
    { id:'street', name:'Street Court', cost:2500, mult:3, icon:'🌆', ambience:.08, bg:'#ec6f66' },
    { id:'gym', name:'School Gym', cost:25000, mult:10, icon:'🏫', ambience:.12, bg:'#b5651d' },
    { id:'college', name:'College Arena', cost:250000, mult:35, icon:'🎓', ambience:.2, bg:'#335cbe' },
    { id:'pro', name:'Professional Stadium', cost:2500000, mult:120, icon:'🏟️', ambience:.32, bg:'#536dfe' },
    { id:'space', name:'Moon Basketball Arena', cost:25000000, mult:420, icon:'🌙', ambience:.18, bg:'#240046' }
  ];
  const upgrades = [
    { id:'power', name:'Power Training', icon:'💪', base:25, scale:1.18, desc:'+8% shot value and easier long arcs.' },
    { id:'accuracy', name:'Accuracy Coaching', icon:'🎯', base:40, scale:1.2, desc:'+5% make chance and swish control.' },
    { id:'value', name:'Shot Value', icon:'💵', base:75, scale:1.22, desc:'+15% money per basket.' },
    { id:'auto', name:'Auto Shooter', icon:'🤖', base:150, scale:1.24, desc:'Adds automatic driveway shots.' },
    { id:'balls', name:'Ball Machine', icon:'🏀', base:450, scale:1.26, desc:'Extra auto balls and faster barrage.' },
    { id:'coach', name:'Assistant Coach', icon:'📋', base:900, scale:1.25, desc:'Improves auto accuracy and combo hold.' },
    { id:'sponsor', name:'Sponsorship Deals', icon:'🤝', base:1800, scale:1.28, desc:'Passive sponsor revenue every second.' },
    { id:'fans', name:'VIP Fans', icon:'🪩', base:6500, scale:1.3, desc:'Bigger tips, louder reactions.' },
    { id:'media', name:'Media Coverage', icon:'📺', base:22000, scale:1.32, desc:'Fame-like income multiplier.' },
    { id:'celeb', name:'Celebrity Endorsements', icon:'🌟', base:90000, scale:1.34, desc:'Huge swish and perfect bonuses.' },
    { id:'franchise', name:'Franchise Expansion', icon:'🏢', base:500000, scale:1.36, desc:'Arena revenue and empire scaling.' }
  ];
  const minigames = [
    { id:'free', name:'Free Throw Challenge', icon:'🎯', unlock:0, reward:60, desc:'Ten silky freebies with swish odds.' },
    { id:'three', name:'3 Point Contest', icon:'3️⃣', unlock:1, reward:450, desc:'Rapid threes under neon lights.' },
    { id:'half', name:'Half Court Hero', icon:'🚀', unlock:2, reward:3500, desc:'One dramatic launch. Big jackpot.' },
    { id:'lucky', name:'Lucky Bounce', icon:'🍀', unlock:3, reward:18000, desc:'Ricochet off bumpers for cash.' },
    { id:'jackpot', name:'Skill Shot Jackpot', icon:'💎', unlock:4, reward:120000, desc:'Thread the needle for a premium prize.' }
  ];
  const state = {
    money:0, fame:0, xp:0, court:0, shots:0, baskets:0, swishes:0, perfects:0, misses:0, combo:0, bestCombo:0,
    upgrades:Object.fromEntries(upgrades.map(u=>[u.id,0])), achievements:{}, lastSave:Date.now(), muted:false, totalEarned:0, minigameUntil:0
  };
  let W=0,H=0, dpr=1, last=performance.now(), autoTimer=0, ambientTimer=0, uiTimer=0, shotDrag=null, hitPause=0, slowMo=0;
  const balls=[], particles=[], floaters=[], fireworks=[], stars=[];
  for(let i=0;i<120;i++) stars.push({x:Math.random(),y:Math.random()*.75,r:Math.random()*1.8+.2,a:Math.random()});
  const hoop = { x:0,y:0,w:118,h:14,shake:0,net:0,kind:0 };
  const start = { x:0,y:0 };
  let audioCtx, master, crowdGain, spaceGain;

  function fmt(n){ if(n<1000) return '$'+Math.floor(n); const units=['K','M','B','T','Qa','Qi']; let u=-1; while(n>=1000&&u<units.length-1){n/=1000;u++;} return '$'+n.toFixed(n<10?2:n<100?1:0)+units[u]; }
  function num(n){ if(n<1000) return Math.floor(n).toString(); const units=['K','M','B','T','Qa','Qi']; let u=-1; while(n>=1000&&u<units.length-1){n/=1000;u++;} return n.toFixed(n<10?2:n<100?1:0)+units[u]; }
  function level(id){ return state.upgrades[id] || 0; }
  function upgradeCost(u){ return Math.floor(u.base * Math.pow(u.scale, level(u.id)) * (1 - Math.min(.35,state.fame*.006))); }
  function fameMult(){ return 1 + state.fame * .06; }
  function courtMult(){ return courts[state.court].mult; }
  function shotValue(){ return (1 + level('power')*.08 + level('value')*.15 + level('fans')*.12 + level('media')*.18 + level('franchise')*.35) * courtMult() * fameMult(); }
  function passive(){ return (level('sponsor')*8 + level('franchise')*75*courtMult() + level('media')*3) * fameMult(); }
  function autoRate(){ return level('auto')*.42 + level('balls')*.55 + level('franchise')*.14; }
  function ensureAudio(){ if(audioCtx) return; audioCtx = new (window.AudioContext||window.webkitAudioContext)(); master=audioCtx.createGain(); master.gain.value=state.muted?0:.45; master.connect(audioCtx.destination); crowdGain=audioCtx.createGain(); crowdGain.gain.value=0; crowdGain.connect(master); spaceGain=audioCtx.createGain(); spaceGain.gain.value=0; spaceGain.connect(master); }
  function tone(freq, dur=.12, type='sine', vol=.2, dest=master, when=0){ if(!audioCtx || state.muted) return; const t=audioCtx.currentTime+when, o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=type; o.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+.02); }
  function noise(dur=.18, vol=.15, filter=900, when=0){ if(!audioCtx || state.muted) return; const t=audioCtx.currentTime+when, len=audioCtx.sampleRate*dur, b=audioCtx.createBuffer(1,len,audioCtx.sampleRate), data=b.getChannelData(0); for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*(1-i/len); const s=audioCtx.createBufferSource(); s.buffer=b; const f=audioCtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=filter; const g=audioCtx.createGain(); g.gain.value=vol; s.connect(f); f.connect(g); g.connect(master); s.start(t); }
  const sfx={ bounce:()=>{tone(90+Math.random()*55,.09,'sine',.16);noise(.04,.04,180)}, rim:()=>{tone(620,.5,'triangle',.12);tone(1240,.24,'sine',.06)}, board:()=>{tone(160,.18,'square',.1);noise(.12,.09,520)}, swish:()=>{noise(.32,.18,1700);tone(920,.16,'sine',.06,master)}, perfect:()=>{noise(.45,.22,2300);[660,880,1320,1760].forEach((f,i)=>tone(f,.22,'sine',.09,master,i*.035))}, coin:()=>{tone(1046,.08,'triangle',.12);tone(1568,.12,'triangle',.08,master,.06)}, cash:()=>{[523,659,784,1046].forEach((f,i)=>tone(f,.12,'square',.1,master,i*.06));noise(.25,.08,1200,.18)}, fanfare:()=>{[523,659,784,1046,1318].forEach((f,i)=>tone(f,.22,'triangle',.12,master,i*.09))}, prestige:()=>{for(let i=0;i<18;i++) tone(180+i*70,.28,'sawtooth',.08,master,i*.045);noise(1.2,.2,900)} };

  function save(){ state.lastSave=Date.now(); localStorage.setItem('swishFactorySave', JSON.stringify(state)); toast('Saved courtside empire 💾'); }
  function load(){ const raw=localStorage.getItem('swishFactorySave'); if(!raw) return; try{ const data=JSON.parse(raw); Object.assign(state,data); state.upgrades={...state.upgrades,...(data.upgrades||{})}; state.achievements=data.achievements||{}; const offline=Math.min(8*3600,(Date.now()-(data.lastSave||Date.now()))/1000); if(offline>30){ const earned=passive()*offline*.45; earn(earned,false); toast(`Offline hustle earned ${fmt(earned)}`); } }catch(e){ console.warn(e); } }
  function resize(){ dpr=Math.min(2,devicePixelRatio||1); W=innerWidth; H=innerHeight; canvas.width=W*dpr; canvas.height=H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); hoop.x=W*(W<700?.56:.52); hoop.y=H*(W<700?.38:.34); start.x=W*(W<700?.2:.28); start.y=H*(W<700?.74:.72); }
  function toast(msg, cls=''){ const el=document.createElement('div'); el.className='toast '+cls; el.textContent=msg; $('toastStack').appendChild(el); setTimeout(()=>el.remove(),2800); }
  function floater(txt,x,y,color='#fff',size=26){ const el=document.createElement('div'); el.className='floating'; el.style.left=x+'px'; el.style.top=y+'px'; el.style.color=color; el.style.fontSize=size+'px'; el.textContent=txt; document.body.appendChild(el); setTimeout(()=>el.remove(),1350); }
  function shake(){ app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); }
  function flash(){ app.classList.remove('flash'); void app.offsetWidth; app.classList.add('flash'); }
  function burst(x,y,color,count=24,power=1){ for(let i=0;i<count;i++){ const a=Math.random()*TAU, sp=(80+Math.random()*260)*power; particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.5+Math.random()*.8,max:1.1,r:2+Math.random()*5,color,grav:260}); } }
  function confetti(x,y,count=35){ const colors=['#ffd166','#06d6a0','#ef476f','#118ab2','#fff']; for(let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-.5)*420,vy:-Math.random()*380-80,life:1.2,max:1.2,r:3+Math.random()*5,color:colors[i%colors.length],grav:520,rect:true,rot:Math.random()*TAU}); }
  function makeBall(x=start.x,y=start.y,vx=0,vy=0,auto=false){ balls.push({x,y,vx,vy,r:22,spin:0,rot:Math.random()*TAU,life:8,scored:false,auto,bounced:0,trail:[]}); sfx.bounce(); }
  function shoot(vx,vy,auto=false){ ensureAudio(); state.shots++; makeBall(start.x,start.y,vx,vy,auto); checkAchievements(); }
  function quickShot(){ const acc=.56+level('accuracy')*.025+level('coach')*.015; const dx=hoop.x-start.x, dy=hoop.y-start.y; const t=1.05+Math.random()*.18; const vx=dx/t + (Math.random()-.5)*(260*(1-acc)); const vy=(dy-520*t*t/2)/t + (Math.random()-.5)*(220*(1-acc)); shoot(vx,vy,false); }
  function earn(amount, effects=true){ amount=Math.max(0,amount); state.money+=amount; state.totalEarned+=amount; if(effects) { floater('+'+fmt(amount),hoop.x,hoop.y-70,'#ffd166',30); sfx.coin(); } checkAchievements(); updateUI(); }
  function score(ball, swish=false, perfect=false){ if(ball.scored) return; ball.scored=true; state.baskets++; state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); let mult=1+state.combo*.06; if(swish){ state.swishes++; mult+=.65+level('celeb')*.1; } if(perfect){ state.perfects++; mult+=2.75+level('celeb')*.22; slowMo=.35; flash(); shake(); floater('PERFECT SWISH x'+state.combo,hoop.x-90,hoop.y-130,'#fff',34); sfx.perfect(); } else if(swish){ floater('SWISH! x'+state.combo,hoop.x-45,hoop.y-105,'#06d6a0',30); sfx.swish(); } else sfx.rim(); const value=10*shotValue()*mult; earn(value,!perfect); hoop.net=.45; hoop.shake=.25; burst(hoop.x,hoop.y,'#ff7a18',28,swish?1.4:1); confetti(hoop.x,hoop.y,perfect?70:30); if(state.combo%10===0) milestone(`${state.combo} COMBO!`, '#ffd166'); checkAchievements(); }
  function miss(ball){ state.misses++; state.combo=Math.max(0,state.combo-1-level('coach')*.02); state.xp+=1+courtMult()*.25; burst(ball.x,Math.min(H-40,ball.y),'#9ddcff',8,.5); updateUI(); checkAchievements(); }
  function milestone(msg,color){ toast(msg,'achievement'); flash(); shake(); for(let i=0;i<12;i++) fireworks.push({x:W*(.15+Math.random()*.7),y:H*(.15+Math.random()*.35),t:Math.random()*.35,color}); sfx.fanfare(); }
  function buyUpgrade(id){ const u=upgrades.find(x=>x.id===id), c=upgradeCost(u); if(state.money<c) return; state.money-=c; state.upgrades[id]++; burst(W-170,190,'#ffd166',45,1.1); sfx.cash(); toast(`${u.icon} ${u.name} upgraded!`); updateUI(); checkAchievements(); }
  function buyCourt(i){ if(i<=state.court) return; const c=courts[i]; if(state.money<c.cost) return; state.money-=c.cost; state.court=i; app.className='app court-'+c.id; milestone(`${c.icon} ${c.name} unlocked!`, '#fff'); updateUI(); }
  function goPro(){ const need=prestigeGain(); if(need<1) { toast(`Earn ${fmt(1000000)} total to GO PRO`); return; } ensureAudio(); state.fame+=need; state.money=0; state.xp=0; state.court=0; state.combo=0; state.upgrades=Object.fromEntries(upgrades.map(u=>[u.id,0])); app.className='app court-driveway'; $('prestigeOverlay').classList.remove('hidden'); sfx.prestige(); for(let i=0;i<180;i++) setTimeout(()=>burst(W/2,H/2,['#fff','#ffd166','#8d5cff','#06d6a0'][i%4],8,2.2),i*8); setTimeout(()=>$('prestigeOverlay').classList.add('hidden'),2600); milestone(`+${need} FAME!`, '#fff'); updateUI(); save(); }
  function prestigeGain(){ return Math.floor(Math.sqrt(state.totalEarned/1000000)); }
  function runMinigame(id){ const m=minigames.find(x=>x.id===id); if(!m || state.court<m.unlock) return; const reward=m.reward*courtMult()*fameMult()*(1+Math.random()*1.5); earn(reward); milestone(`${m.icon} ${m.name}: ${fmt(reward)}!`, '#ffd166'); for(let i=0;i<7;i++) setTimeout(()=>quickShot(),i*120); }
  function prizeWheel(){ const modal=$('modal'); modal.className='modal'; modal.innerHTML=`<div class="modal-card glass"><h2>Prize Wheel</h2><p>Spin for money, XP, combo boosts, or a jackpot.</p><div class="wheel spin-wheel"></div><button class="primary-action" id="closeWheel">Claim Prize</button></div>`; const reward=(50+Math.random()*950)*courtMult()*fameMult(); setTimeout(()=>{ earn(reward); toast(`Wheel prize: ${fmt(reward)} 🎡`); },1100); $('closeWheel').onclick=()=>{modal.className='modal hidden'; modal.innerHTML='';}; }
  const achievementDefs = [];
  [['First Basket','Score your first basket',1],['100 Baskets','Score 100 baskets',100],['1000 Baskets','Score 1,000 baskets',1000],['10K Baskets','Score 10,000 baskets',10000]].forEach(([n,d,v])=>achievementDefs.push({id:'b'+v,n,d,icon:'🏀',test:()=>state.baskets>=v}));
  [['First Swish','Hear the net sing',1],['Perfect Swish Master','Make 25 perfect swishes',25],['Net Whisperer','Make 250 swishes',250]].forEach(([n,d,v])=>achievementDefs.push({id:'s'+v,n,d,icon:'✨',test:()=>state.swishes>=v||state.perfects>=v}));
  [['Millionaire','Earn $1,000,000 total',1e6],['Arena Owner','Earn $25,000,000 total',25e6],['Basketball Empire','Earn $1,000,000,000 total',1e9]].forEach(([n,d,v])=>achievementDefs.push({id:'m'+v,n,d,icon:'🏆',test:()=>state.totalEarned>=v}));
  achievementDefs.push({id:'prestige1',n:'First Prestige',d:'GO PRO for the first time',icon:'⭐',test:()=>state.fame>0});
  achievementDefs.push({id:'combo25',n:'Combo Crafter',d:'Reach a 25 combo',icon:'🔥',test:()=>state.bestCombo>=25});
  for(let i=1;i<=90;i++){ achievementDefs.push({id:'tier'+i,n:`Factory Badge ${i}`,d:`Reach milestone tier ${i}`,icon:['🥉','🥈','🥇','🏅','💎'][i%5],test:()=>state.baskets+state.swishes*2+Math.floor(state.totalEarned/1000)>=i*i*6}); }
  function checkAchievements(){ let unlocked=0; for(const a of achievementDefs){ if(!state.achievements[a.id] && a.test()){ state.achievements[a.id]=Date.now(); unlocked++; toast(`${a.icon} ${a.n}`,'achievement'); burst(W/2,130,'#ffd166',35,1); sfx.fanfare(); } } if(unlocked) updateUI(); }

  function renderUIList(){
    $('upgradeList').innerHTML=upgrades.map(u=>{ const l=level(u.id), c=upgradeCost(u); return `<div class="upgrade"><div class="icon">${u.icon}</div><div><h4>${u.name} <small>Lv ${l}</small></h4><p>${u.desc}</p></div><button ${state.money<c?'disabled':''} data-buy="${u.id}">${fmt(c)}</button></div>`; }).join('');
    $('courtList').innerHTML=courts.map((c,i)=>`<div class="court ${i<=state.court?'unlocked':''}"><div class="icon">${c.icon}</div><div><h4>${c.name}</h4><p>${i<=state.court?'Owned':fmt(c.cost)} • x${c.mult} earnings</p></div><button ${i<=state.court||state.money<c.cost?'disabled':''} data-court="${i}">${i<=state.court?'✓':'Buy'}</button></div>`).join('');
    $('minigameList').innerHTML=minigames.map(m=>`<div class="mini ${state.court>=m.unlock?'unlocked':''}"><div class="icon">${m.icon}</div><div><h4>${m.name}</h4><p>${state.court>=m.unlock?m.desc:'Unlock at '+courts[m.unlock].name}</p></div><button ${state.court<m.unlock?'disabled':''} data-mini="${m.id}">Play</button></div>`).join('');
    $('achievementList').innerHTML=achievementDefs.map(a=>`<div class="badge ${state.achievements[a.id]?'done':''}"><div class="icon">${a.icon}</div><div><h4>${a.n}</h4><p>${state.achievements[a.id]?'Unlocked':a.d}</p></div></div>`).join('');
    document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buyUpgrade(b.dataset.buy));
    document.querySelectorAll('[data-court]').forEach(b=>b.onclick=()=>buyCourt(+b.dataset.court));
    document.querySelectorAll('[data-mini]').forEach(b=>b.onclick=()=>runMinigame(b.dataset.mini));
  }
  function updateUI(){ $('moneyText').textContent=fmt(state.money); $('fameText').textContent=num(state.fame); $('mpsText').textContent=fmt(passive())+'/s'; $('comboText').textContent='x'+Math.floor(state.combo); $('courtName').textContent=courts[state.court].name; $('xpBar').style.width=(state.xp%100)+'%'; $('xpText').textContent=`${Math.floor(state.xp)} XP • ${state.baskets} baskets • ${state.swishes} swishes • ${state.perfects} perfects`; $('prestigeBtn').textContent=`⭐ GO PRO (+${prestigeGain()} Fame)`; renderUIList(); }

  function drawCourt(){
    const c=courts[state.court];
    if(state.court===5){ ctx.fillStyle='#050014'; ctx.fillRect(0,0,W,H); for(const s of stars){ ctx.globalAlpha=.35+.65*Math.sin(performance.now()/700+s.a*7); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r,0,TAU); ctx.fill(); } ctx.globalAlpha=1; ctx.fillStyle='#b8b8d8'; ctx.beginPath(); ctx.arc(W*.82,H*.18,42,0,TAU); ctx.fill(); }
    ctx.fillStyle='rgba(255,255,255,.08)'; for(let i=0;i<8;i++){ ctx.beginPath(); ctx.arc(W/2,H*.83,120+i*55,Math.PI,TAU); ctx.strokeStyle=`rgba(255,255,255,${.08-i*.006})`; ctx.lineWidth=2; ctx.stroke(); }
    const floor=ctx.createLinearGradient(0,H*.55,0,H); floor.addColorStop(0,state.court===0?'#6dc56d':state.court===1?'#334155':state.court===2?'#d28a42':state.court===5?'#6750a4':'#9b5de5'); floor.addColorStop(1,state.court===0?'#2d6a4f':state.court===1?'#111827':state.court===2?'#8b4513':state.court===5?'#22113d':'#1d2d70'); ctx.fillStyle=floor; ctx.beginPath(); ctx.moveTo(0,H*.58); ctx.lineTo(W,H*.54); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=4; ctx.beginPath(); ctx.ellipse(W*.5,H*.82,W*.26,H*.08,0,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(hoop.x,hoop.y+210,140,Math.PI,TAU); ctx.stroke();
    if(state.court>=3){ for(let i=0;i<70;i++){ ctx.fillStyle=`hsl(${(i*47)%360} 80% 70% / .55)`; ctx.fillRect((i/70)*W,H*.48+Math.sin(i)*16,8,18); } }
  }
  function drawHoop(){ const x=hoop.x+(Math.random()-.5)*hoop.shake*18, y=hoop.y; const style=state.court; ctx.save(); ctx.lineCap='round';
    ctx.strokeStyle=style>=4?'#e9f5ff':style>=2?'#243b53':'#5b4636'; ctx.lineWidth=12; ctx.beginPath(); ctx.moveTo(x+76,y+8); ctx.lineTo(x+76,y+180); ctx.stroke();
    const boardGrad=ctx.createLinearGradient(x-75,y-100,x+80,y+5); boardGrad.addColorStop(0,'rgba(255,255,255,.92)'); boardGrad.addColorStop(1,style===5?'rgba(176,224,255,.42)':'rgba(210,240,255,.72)'); ctx.fillStyle=boardGrad; roundRect(x-95,y-110,170,100,14,true); ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=4; roundRect(x-45,y-72,70,45,4,false);
    ctx.strokeStyle=style===5?'#7df9ff':'#ff3d00'; ctx.lineWidth=9; ctx.beginPath(); ctx.ellipse(x-18,y,58,13,0,0,TAU); ctx.stroke(); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=2; for(let i=0;i<9;i++){ const nx=x-70+i*13; ctx.beginPath(); ctx.moveTo(nx,y+8); ctx.quadraticCurveTo(x-18,y+52+hoop.net*35,nx+6,y+88); ctx.stroke(); } ctx.restore(); }
  function drawBall(b){ b.trail.forEach((t,i)=>{ ctx.globalAlpha=i/b.trail.length*.45; ctx.fillStyle='#ffb703'; ctx.beginPath(); ctx.arc(t.x,t.y,b.r*(i/b.trail.length),0,TAU); ctx.fill(); }); ctx.globalAlpha=1; ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot); ctx.scale(1+Math.min(.18,Math.abs(b.vy)/2600),1-Math.min(.14,Math.abs(b.vy)/3200)); const g=ctx.createRadialGradient(-9,-12,2,0,0,b.r); g.addColorStop(0,'#ffd39b'); g.addColorStop(.35,'#ff8f22'); g.addColorStop(1,'#bf3c08'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,b.r,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(70,25,6,.85)'; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(0,0,b.r*.92,b.r*.28,0,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0,0,b.r*.28,b.r*.92,0,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(-b.r*.72,0,b.r*.8,-1.1,1.1); ctx.stroke(); ctx.beginPath(); ctx.arc(b.r*.72,0,b.r*.8,2.04,4.24); ctx.stroke(); ctx.fillStyle='rgba(255,255,255,.38)'; ctx.beginPath(); ctx.ellipse(-7,-11,7,4,-.5,0,TAU); ctx.fill(); ctx.restore(); }
  function roundRect(x,y,w,h,r,fill){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); fill?ctx.fill():ctx.stroke(); }
  function drawAim(){ if(!shotDrag) return; const dx=shotDrag.x-(window._swishPointerX||shotDrag.x), dy=shotDrag.y-(window._swishPointerY||shotDrag.y); ctx.save(); ctx.setLineDash([10,10]); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(start.x,start.y); ctx.quadraticCurveTo(start.x+dx*.7,start.y+dy*.9, start.x+dx*1.35,start.y+dy*1.35); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='rgba(255,209,102,.25)'; ctx.beginPath(); ctx.arc(start.x,start.y,34+Math.min(30,Math.hypot(dx,dy)/8),0,TAU); ctx.fill(); ctx.restore(); }
  function drawParticles(dt){ for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt; p.vy+=p.grav*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,p.life/p.max); ctx.fillStyle=p.color; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate((p.rot||0)+p.life*5); if(p.rect) ctx.fillRect(-p.r,-p.r,p.r*2,p.r*1.2); else { ctx.beginPath(); ctx.arc(0,0,p.r,0,TAU); ctx.fill(); } ctx.restore(); if(p.life<=0) particles.splice(i,1); } ctx.globalAlpha=1; for(let i=fireworks.length-1;i>=0;i--){ const f=fireworks[i]; f.t-=dt; if(f.t<=0){ burst(f.x,f.y,f.color,44,1.5); fireworks.splice(i,1); } } }
  function physics(dt){ dt*=slowMo>0?.35:1; slowMo-=dt; const grav=620; for(let i=balls.length-1;i>=0;i--){ const b=balls[i]; b.life-=dt; b.trail.push({x:b.x,y:b.y}); if(b.trail.length>12) b.trail.shift(); b.vy+=grav*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.rot+=b.vx*dt*.035; b.spin=b.vx*.02; if(b.y+b.r>H-28){ b.y=H-28-b.r; b.vy*=-.48; b.vx*=.82; b.bounced++; sfx.bounce(); if(b.bounced>2&&!b.scored) miss(b); }
      if(!b.scored && b.x>hoop.x-72 && b.x<hoop.x+38 && b.y>hoop.y-12 && b.y<hoop.y+30 && b.vy>0){ const center=Math.abs(b.x-(hoop.x-18)); const swish=center<25 && b.bounced===0; const perfect=center<10 && Math.abs(b.vx)<90 && b.bounced===0; score(b,swish,perfect); }
      if(!b.scored && Math.abs(b.x-(hoop.x-18))<76 && Math.abs(b.y-hoop.y)<25 && b.vy>0 && Math.random()<.03){ b.vx*=-.45; b.vy*=-.35; hoop.shake=.2; sfx.rim(); }
      if(!b.scored && b.x>hoop.x-100 && b.x<hoop.x+80 && b.y>hoop.y-112 && b.y<hoop.y-8 && b.vx>0){ b.vx*=-.55; b.vy*=.88; sfx.board(); }
      if(b.life<=0||b.x<-200||b.x>W+200||b.y>H+220) balls.splice(i,1); }
    hoop.shake=Math.max(0,hoop.shake-dt); hoop.net=Math.max(0,hoop.net-dt); }
  function loop(now){ let dt=Math.min(.033,(now-last)/1000); last=now; if(hitPause>0){ hitPause-=dt; dt=0; } ctx.clearRect(0,0,W,H); drawCourt(); drawHoop(); drawAim(); physics(dt); for(const b of balls) drawBall(b); drawParticles(dt); const ar=autoRate(); if(ar>0){ autoTimer+=dt*ar; while(autoTimer>1){ autoTimer--; const acc=.45+level('accuracy')*.018+level('coach')*.026; const dx=hoop.x-start.x, dy=hoop.y-start.y, t=1.05+Math.random()*.25; shoot(dx/t+(Math.random()-.5)*330*(1-acc),(dy-620*t*t/2)/t+(Math.random()-.5)*250*(1-acc),true); } } const pps=passive(); if(pps>0){ state.money+=pps*dt; state.totalEarned+=pps*dt; } uiTimer+=dt; if(uiTimer>.25){ uiTimer=0; updateUI(); checkAchievements(); } ambientTimer+=dt; if(ambientTimer>4 && state.court>=1){ ambientTimer=0; noise(.8,courts[state.court].ambience, state.court===5?180:420); } requestAnimationFrame(loop); }

  canvas.addEventListener('pointerdown',e=>{ ensureAudio(); const r=canvas.getBoundingClientRect(); shotDrag={x:e.clientX-r.left,y:e.clientY-r.top}; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove',e=>{ if(shotDrag){ const r=canvas.getBoundingClientRect(); window._swishPointerX=e.clientX-r.left; window._swishPointerY=e.clientY-r.top; } });
  canvas.addEventListener('pointerup',e=>{ if(!shotDrag) return; const r=canvas.getBoundingClientRect(); const dx=shotDrag.x-(e.clientX-r.left), dy=shotDrag.y-(e.clientY-r.top); shoot(dx*3.2,dy*3.2,false); shotDrag=null; window._swishPointerX=window._swishPointerY=0; });
  $('shootBtn').onclick=quickShot; $('saveBtn').onclick=save; $('wheelBtn').onclick=prizeWheel; $('prestigeBtn').onclick=goPro; $('soundBtn').onclick=()=>{ ensureAudio(); state.muted=!state.muted; master.gain.value=state.muted?0:.45; $('soundBtn').textContent=state.muted?'🔇 Muted':'🔊 Sound'; };
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{ document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active')); t.classList.add('active'); $(t.dataset.tab).classList.add('active'); });
  setInterval(save,30000); addEventListener('beforeunload',save); addEventListener('resize',resize);
  load(); resize(); updateUI(); requestAnimationFrame(loop); toast('Welcome to Swish Factory — drag the court or hit Quick Shot!');
})();
