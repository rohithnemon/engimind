/* EngiMind AI frontend. Adjust API below to match your FastAPI contract. */
const API = {
  endpoint: localStorage.getItem('em_ep') || '/api/solve',
  body: (task, domain) => ({ task, domain }),
  read: d => {
    const sections = [];
    if (d.specialist_analysis) sections.push('# Specialist analysis\n' + d.specialist_analysis);
    if (d.assumptions?.length) sections.push('# Assumptions\n' + d.assumptions.map(x => '• ' + x).join('\n'));
    if (d.missing_inputs?.length) sections.push('# Missing information\n' + d.missing_inputs.map(x => '• ' + x).join('\n'));
    if (d.validation_checklist?.length) sections.push('# Validation checklist\n' + d.validation_checklist.map(x => '☐ ' + x).join('\n'));
    if (!sections.length) sections.push(d.report || d.response || d.result || d.output || (typeof d === 'string' ? d : JSON.stringify(d, null, 2)));
    return { text: sections.join('\n\n'), agent: d.specialist || d.agent || d.domain || null, validated: false };
  }
};
const D = {
  auto:{n:'Auto-detect',a:'Orchestrator',d:'The orchestrator reads the task and routes it to a specialist.',p:['Size a simply supported beam for a 6 m span','Estimate the cooling load of a 3-storey office','Check voltage drop on a 120 m feeder','Select a bearing for a 1500 rpm shaft']},
  civil:{n:'Civil',a:'Civil Agent',d:'Site, buildings, roads, drainage and infrastructure planning.',p:['Plan drainage for a 2 ha residential plot','Estimate concrete volume for a 4-storey slab system','Outline a geotechnical investigation for a bridge pier']},
  structural:{n:'Structural',a:'Structural Agent',d:'Loads, members, connections and stability checks.',p:['Check a steel column under 800 kN axial load','Design a RC slab for a 5×6 m room','Review a truss for wind uplift']},
  electrical:{n:'Electrical',a:'Electrical Agent',d:'Power distribution, protection, cabling and load calculation.',p:['Size a cable and breaker for a 22 kW motor','Compute demand load for a 12-flat building','Plan earthing for a 33/11 kV substation']},
  mechanical:{n:'Mechanical',a:'Mechanical Agent',d:'Machines, thermal systems, fluids and component selection.',p:['Size a pump for 40 m³/h at 35 m head','Design a spur gear pair for 5 kW','Estimate heat exchanger duty for a 200 L/h flow']}
};
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let domain = 'auto', last = null;

/* ---------- UI helpers ---------- */
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;$('#toasts').append(t);setTimeout(()=>t.remove(),2800)}
const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function setDomain(k){
  domain = k; document.documentElement.dataset.domain = k;
  $$('.dc').forEach(c => c.setAttribute('aria-checked', c.dataset.k === k));
  const x = D[k];
  $('#agentBox').innerHTML = `<div><b>${x.a}</b><br><span>${x.d}</span></div>`;
  $('#agentLine').textContent = k === 'auto' ? D.auto.d : `${x.a} selected`;
  $('#chips').innerHTML = x.p.map(p => `<button type="button">${p}</button>`).join('');
  $$('#chips button').forEach(b => b.onclick = () => { $('#task').value = b.textContent; $('#task').focus(); });
  fadeTo(k);
}
function buildCards(){
  $('#domains').innerHTML = Object.entries(D).map(([k,x]) =>
    `<button class="dc" role="radio" aria-checked="false" data-k="${k}" style="--c:${{auto:'#4cc9f0',civil:'#4cc9f0',structural:'#ffb347',electrical:'#8b8dff',mechanical:'#ff6b5e'}[k]}"><b>${x.n}</b><span>${k==='auto'?'Let the orchestrator choose':x.a}</span></button>`).join('');
  $$('.dc').forEach(c => {
    c.onclick = () => setDomain(c.dataset.k);
    c.onmousemove = e => { const r=c.getBoundingClientRect(); c.style.transform=`rotateX(${-((e.clientY-r.top)/r.height-.5)*10}deg) rotateY(${((e.clientX-r.left)/r.width-.5)*12}deg) translateZ(8px)` };
    c.onmouseleave = () => c.style.transform = '';
  });
  $('#specs').innerHTML = ['civil','structural','electrical','mechanical'].map(k => `<span data-s="${k}">${D[k].n}</span>`).join('');
}

/* ---------- Pipeline (reflects real events only) ---------- */
function flow(state){
  $$('[data-s]').forEach(e => e.classList.remove('on2','done'));
  const on = s => $(`[data-s="${s}"]`)?.classList.add('on2'), done = s => $(`[data-s="${s}"]`)?.classList.add('done');
  if (state.stage === 'sent'){ done('task'); on('orch'); $('#flowNote').textContent = 'Request sent. The backend has not reported further stages.'; }
  if (state.stage === 'back'){ done('task'); done('orch'); done('rep'); if (state.agent) done(state.agent); if (state.validated) done('val');
    $('#flowNote').textContent = state.agent ? `Backend reported: ${state.agent}.` : 'Backend did not report which specialist ran.'; }
  if (state.stage === 'err'){ done('task'); $('#flowNote').textContent = 'Request failed before a result came back.'; }
}

/* ---------- Analysis ---------- */
function render(text){
  const parts = text.split(/\n(?=#{1,3}\s)/);
  $('#body').innerHTML = parts.map(p => {
    const m = p.match(/^#{1,3}\s*(.+)\n?([\s\S]*)/);
    return m ? `<div class="sec"><h3>${esc(m[1])}</h3><pre>${esc(m[2].trim())}</pre></div>` : `<div class="sec"><pre>${esc(p)}</pre></div>`;
  }).join('');
}
async function run(){
  const task = $('#task').value.trim();
  if (!task) return toast('Describe the task first');
  $('#run').disabled = true; $('#empty').hidden = true; $('#out').hidden = false; $('#out').classList.remove('err');
  $('#outTitle').textContent = 'Waiting for backend…';
  $('#body').innerHTML = '<div class="sk"></div><div class="sk" style="width:80%"></div><div class="sk" style="width:60%"></div>';
  flow({stage:'sent'});
  try {
    const r = await fetch(API.endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(API.body(task, domain))});
    const ct = r.headers.get('content-type') || '';
    const payload = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error((payload && payload.detail) || `Server returned ${r.status}`);
    const res = API.read(payload);
    const key = res.agent && Object.keys(D).find(k => k !== 'auto' && String(res.agent).toLowerCase().includes(k));
    last = {task, text:res.text, domain:key || domain, at:Date.now()};
    $('#outTitle').textContent = key ? D[key].a : 'Result';
    if (key && domain === 'auto') document.documentElement.dataset.domain = key, fadeTo(key);
    render(res.text); flow({stage:'back', agent:key, validated:res.validated});
  } catch (e) {
    $('#out').classList.add('err'); $('#outTitle').textContent = 'Analysis failed';
    $('#body').innerHTML = `<div class="sec"><h3>What happened</h3><pre>${esc(e.message)}\n\nCheck that FastAPI is running and that the endpoint in Settings (${esc(API.endpoint)}) matches your route.</pre></div>`;
    flow({stage:'err'});
  } finally { $('#run').disabled = false; }
}
const getSaved = () => JSON.parse(localStorage.getItem('em_saved') || '[]');
function drawSaved(){
  $('#saved').innerHTML = getSaved().map((s,i) => `<li><button data-i="${i}" title="${esc(s.task)}">${esc(s.task)}</button></li>`).join('') || '<li><small>Nothing saved yet</small></li>';
  $$('#saved button').forEach(b => b.onclick = () => { last = getSaved()[b.dataset.i]; $('#task').value = last.task; setDomain(last.domain); $('#empty').hidden = true; $('#out').hidden = false; render(last.text); });
}

/* ---------- 3D backgrounds: one procedural scene per domain ---------- */
let fadeTo = () => {};
function initScene(){
  if (!window.THREE) return;
  const T = THREE, cv = $('#bg'), R = new T.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
  R.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const S = new T.Scene(); S.fog = new T.FogExp2(0x050a14, .028);
  const C = new T.PerspectiveCamera(55, 1, .1, 200); C.position.set(0, 7, 22);
  const G = {}, mats = {};
  const mk = (k, col) => { G[k] = new T.Group(); mats[k] = []; S.add(G[k]); return col; };
  const mat = (k, col, o=.55) => { const m = new T.LineBasicMaterial({color:col, transparent:true, opacity:0}); m.userData.o = o; mats[k].push(m); return m; };
  const edges = (k, geo, col, o) => { const l = new T.LineSegments(new T.EdgesGeometry(geo), mat(k, col, o)); G[k].add(l); return l; };
  const segs = (k, pts, col, o) => { const l = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), mat(k, col, o)); G[k].add(l); return l; };
  const grid = (k, col) => { const g = new T.GridHelper(120, 60, col, col); g.material = mat(k, col, .18); G[k].add(g); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Civil: skyline with a crane
  mk('civil'); grid('civil', 0x4cc9f0);
  for (let i = 0; i < 70; i++){ const w = rnd(1.2,3), h = rnd(3,18), b = new T.BoxGeometry(w,h,w); const e = edges('civil', b, 0x4cc9f0, .6); e.position.set(rnd(-40,40), h/2, rnd(-45,6)); if (Math.abs(e.position.x) < 4) e.position.x += 9; }
  const crane = []; for (let y=0;y<22;y+=2){crane.push(new T.Vector3(-1,y,0),new T.Vector3(-1,y+2,0),new T.Vector3(1,y,0),new T.Vector3(1,y+2,0),new T.Vector3(-1,y,0),new T.Vector3(1,y+2,0))}
  crane.push(new T.Vector3(-1,22,0),new T.Vector3(14,22,0),new T.Vector3(-1,22,0),new T.Vector3(-6,22,0));
  const cr = segs('civil', crane, 0xffffff, .5); cr.position.set(-12,0,-14);
  // Structural: Warren truss bridge
  mk('structural'); grid('structural', 0xffb347);
  const tr = [], n = 14, L = 3;
  for (const z of [-3, 3]) for (let i = 0; i <= n; i++){ const x = (i-n/2)*L; tr.push(new T.Vector3(x,0,z),new T.Vector3(x,5,z)); if (i<n){ tr.push(new T.Vector3(x,0,z),new T.Vector3(x+L,0,z),new T.Vector3(x,5,z),new T.Vector3(x+L,5,z),new T.Vector3(x,i%2?5:0,z),new T.Vector3(x+L,i%2?0:5,z)); } }
  for (let i=0;i<=n;i++){ const x=(i-n/2)*L; tr.push(new T.Vector3(x,0,-3),new T.Vector3(x,0,3),new T.Vector3(x,5,-3),new T.Vector3(x,5,3)); }
  const br = segs('structural', tr, 0xffb347, .8); br.position.y = 2;
  for (const x of [-21,21]) edges('structural', new T.BoxGeometry(3,14,9), 0xffb347, .35).position.set(x,-3,0);
  // Electrical: circuit board traces + nodes
  mk('electrical'); grid('electrical', 0x8b8dff);
  const ct = [], nodes = [];
  for (let i=0;i<90;i++){ let x=rnd(-40,40), z=rnd(-40,10); nodes.push(x,.1,z); for(let s=0;s<4;s++){ const nx = s%2?x:x+rnd(-8,8), nz = s%2?z+rnd(-8,8):z; ct.push(new T.Vector3(x,.1,z),new T.Vector3(nx,.1,nz)); x=nx; z=nz; } nodes.push(x,.1,z); }
  segs('electrical', ct, 0x8b8dff, .7);
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(nodes,3));
  const pm = new T.PointsMaterial({color:0xcfd0ff, size:.35, transparent:true, opacity:0}); pm.userData.o=1; mats.electrical.push(pm); G.electrical.add(new T.Points(pg, pm));
  for (let i=0;i<8;i++){ edges('electrical', new T.BoxGeometry(rnd(2,5),rnd(.6,2),rnd(2,4)), 0x8b8dff, .8).position.set(rnd(-25,25),.8,rnd(-30,0)); }
  // Mechanical: meshing gears
  mk('mechanical');
  const gear = (r, teeth, depth) => { const s = new T.Shape(), a = Math.PI*2/teeth; for (let i=0;i<teeth;i++){ const t=i*a, p=[[r,t],[r,t+a*.2],[r*1.18,t+a*.3],[r*1.18,t+a*.55],[r,t+a*.65]]; p.forEach(([q,u],j)=>{const px=Math.cos(u)*q, py=Math.sin(u)*q; (i||j)?s.lineTo(px,py):s.moveTo(px,py)}); }
    const h = new T.Path(); h.absarc(0,0,r*.35,0,Math.PI*2,true); s.holes.push(h);
    return new T.ExtrudeGeometry(s,{depth,bevelEnabled:false}); };
  const gears = [[6,20,0,0,1],[4.2,14,10.4,0,-1],[3,10,-3.3,-8.8,-1],[5,17,3,-9,1]].map(([r,t,x,y,d]) => { const g = edges('mechanical', gear(r,t,1.6), 0xff6b5e, .85); g.position.set(x,y+4,0); g.userData.d = d*(20/t); g.userData.ph=0; return g; });
  gears[1].rotation.z = Math.PI/14; gears[2].rotation.z=Math.PI/10; gears[3].rotation.z=.1;
  const shaft = edges('mechanical', new T.CylinderGeometry(.6,.6,22,10,1), 0xff6b5e, .5); shaft.rotation.z = Math.PI/2; shaft.position.set(0,-8,-4);
  // default: auto shows a blend of civil + electrical
  let target = 'auto'; const mix = {civil:0,structural:0,electrical:0,mechanical:0};
  fadeTo = k => target = k;
  const want = k => k === 'auto' ? {civil:.55, electrical:.35, structural:0, mechanical:0}[k] ?? 0 : 0;
  const size = () => { R.setSize(innerWidth, innerHeight, false); C.aspect = innerWidth/innerHeight; C.updateProjectionMatrix(); };
  addEventListener('resize', size); size();
  let mx = 0, my = 0; addEventListener('pointermove', e => { mx = e.clientX/innerWidth - .5; my = e.clientY/innerHeight - .5; });
  const clock = new T.Clock(), reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  (function loop(){
    const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta(), .05);
    for (const k in mix){ const goal = target === 'auto' ? ({civil:.55, electrical:.4}[k] || 0) : (k === target ? 1 : 0); mix[k] += (goal - mix[k]) * .06; G[k].visible = mix[k] > .01; mats[k].forEach(m => m.opacity = m.userData.o * mix[k]); }
    if (!reduce){
      C.position.x += (mx*10 - C.position.x) * .04; C.position.y += (7 - my*5 - C.position.y) * .04;
      const orbit = target === 'mechanical' ? 0 : Math.sin(t*.12)*.25; C.position.x += orbit*.05;
      C.lookAt(0, target === 'mechanical' ? 4 : 3, target === 'mechanical' ? 0 : -8);
      gears.forEach(g => g.rotation.z += g.userData.d * .0035);
      G.civil.children.forEach(c => { if (c.isLineSegments && c.geometry.type === 'BufferGeometry') c.rotation.y = Math.sin(t*.2)*.35; });
      G.structural.rotation.y = Math.sin(t*.15)*.25; G.electrical.rotation.y = Math.sin(t*.1)*.08;
      mats.electrical[0].opacity = mats.electrical[0].userData.o * mix.electrical * (.55 + .4*Math.sin(t*2));
    }
    R.render(S, C); requestAnimationFrame(loop);
  })();
}

/* ---------- Wiring ---------- */
buildCards(); setDomain('auto'); drawSaved(); initScene();
$('#run').onclick = run;
$('#task').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
$('#copy').onclick = () => last && navigator.clipboard.writeText(last.text).then(() => toast('Copied result'));
$('#exp').onclick = () => { if (!last) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`# EngiMind AI report\n\n**Task:** ${last.task}\n\n${last.text}\n\n> Professional engineering review required.`], {type:'text/markdown'})); a.download = 'engimind-report.md'; a.click(); toast('Exported report'); };
$('#save').onclick = () => { if (!last) return; const s = getSaved().filter(x => x.at !== last.at); s.unshift(last); localStorage.setItem('em_saved', JSON.stringify(s.slice(0,30))); drawSaved(); toast('Saved locally'); };
$('#again').onclick = () => { $('#task').value = ''; $('#out').hidden = true; $('#empty').hidden = false; flow({}); $('#flowNote').textContent = 'Stages light up only when the backend reports them.'; $('#task').focus(); };
$('#collapse').onclick = () => $('#side').classList.toggle('min');
$('#menu').onclick = () => $('#side').classList.toggle('open');
$('#ep').value = API.endpoint; $('#ep').onchange = e => { localStorage.setItem('em_ep', e.target.value.trim()); API.endpoint = e.target.value.trim(); toast('Endpoint updated'); checkHealth(); };
async function checkHealth(){
  const status = $('#apiStatus'); const detail = $('#healthDetail');
  try {
    const base = API.endpoint.replace(/\/api\/(solve|analyze)\/?$/, '');
    const r = await fetch(`${base}/api/health`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    status.textContent = d.status === 'ok' ? 'Backend connected' : 'Backend unavailable';
    status.style.color = d.status === 'ok' ? '#72e0ad' : '#ffb347';
    if (detail) detail.textContent = d.api_key_configured ? 'Backend connected · API key configured on server.' : 'Backend connected · OpenAI API key is not configured in .env.';
  } catch(e) {
    status.textContent = 'Backend offline'; status.style.color = '#ff6b5e';
    if (detail) detail.textContent = 'Cannot reach FastAPI. Start the backend with: uvicorn app:app --reload';
  }
}
checkHealth();
$$('.nav').forEach(b => b.onclick = () => {
  $$('.nav').forEach(n => n.classList.toggle('on', n === b)); $('#side').classList.remove('open');
  const g = b.dataset.go; $('#viz').classList.toggle('show', g === 'viz'); $('#settings').classList.toggle('show', g === 'settings');
  $('#work').hidden = g === 'viz' || g === 'settings'; if (g === 'domains') $('#domains').scrollIntoView();
});
