const $ = s => document.querySelector(s);
const hostSelect = $('#hostSelect'), host = $('#host'), status = $('#networkStatus');
async function loadNetwork(){
  const n = await fetch('/api/network').then(r=>r.json());
  hostSelect.innerHTML = '<option value="">Выбрать найденный адрес…</option>' + n.interfaces.map(ip=>`<option value="${ip}">${ip}</option>`).join('');
  host.value = n.current;
}
hostSelect.onchange = () => { if(hostSelect.value) host.value = hostSelect.value; };
$('#saveNetwork').onclick = async () => {
  status.textContent = 'Сохраняю…';
  try {
    const r = await fetch('/api/join-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host:host.value})});
    const data = await r.json(); if(!r.ok) throw new Error(data.error || 'Ошибка');
    status.textContent = `✓ QR на LIVE-экране обновлён: ${data.url}`;
  } catch(e) { status.textContent = `❌ ${e.message}`; }
};
(async()=>{
  await loadNetwork();
  const cs=await fetch('/api/creatures').then(r=>r.json());
  const normal=cs.filter(c=>c.type!=='bonus' && (c.tier||'normal')==='normal');
  const rare=cs.filter(c=>c.type!=='bonus' && c.tier==='rare');
  const legendary=cs.filter(c=>c.type!=='bonus' && c.tier==='legendary');
  const bonuses=cs.filter(c=>c.type==='bonus');
  const cards=list=>list.map(c=>`<article class="creature-card admin-creature-card"><img src="${c.image || `/images/${encodeURIComponent(c.id)}.jpg`}" alt="${esc(c.name)}" onerror="this.style.display='none'"><div><b>${esc(c.name)}</b><small>${esc(c.rarity)} · ${c.xp ? c.xp+' XP' : 'СПЕЦКАРТА'}</small>${c.effectText?`<small class="admin-effect">${esc(c.effectText)}</small>`:''}<img class="admin-qr" src="/qr/${encodeURIComponent(c.id)}.png" alt="QR ${esc(c.name)}"><a href="/qr/${encodeURIComponent(c.id)}.png" target="_blank">Открыть QR</a></div></article>`).join('');
  $('#qrList').innerHTML=`<div class="admin-tier"><h3>ОБЫЧНЫЕ</h3><div class="collection">${cards(normal)||'<p>Пусто</p>'}</div></div><div class="admin-tier"><h3>РЕДКИЕ</h3><div class="collection">${cards(rare)||'<p>Пусто</p>'}</div></div><div class="admin-tier"><h3>ЛЕГЕНДАРНЫЕ</h3><div class="collection">${cards(legendary)||'<p>Пусто</p>'}</div></div><div class="admin-tier"><h3>🎁 ДОП. БОНУСЫ</h3><div class="collection">${cards(bonuses)||'<p>Пусто</p>'}</div></div>`;
  $('#reset').onclick=async()=>{if(confirm('Сбросить игроков и поимки?')){await fetch('/api/admin/reset',{method:'POST'});alert('Игра сброшена');}};
})();
function esc(x){return String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
