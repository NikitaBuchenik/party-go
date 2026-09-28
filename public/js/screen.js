const $=s=>document.querySelector(s); const socket=io();
function refreshJoin(version){ const q=$('#screenJoinQr'); if(q) q.src=`/qr/join.png?v=${version||Date.now()}`; }
function render(s){
 $('#online').textContent=s.online; $('#captures').textContent=s.totalCaptures; $('#unique').textContent=`${s.uniqueCaught}/${s.totalCreatures}`; $('#top').textContent=s.players[0]?.name||'—';
 $('#leaderboard').innerHTML=s.players.slice(0,10).map((p,i)=>`<div class="rank"><strong>${String(i+1).padStart(2,'0')}</strong><b>${esc(p.name)}</b><span>${p.xp} XP · ${p.captures} поймано ${p.online?'●':''}</span></div>`).join('')||'<p>Ждём игроков…</p>';
 $('#recent').innerHTML=s.recent.map(x=>`<div class="event"><b>${esc(x.playerName)}</b><span>поймал ${esc(x.creature?.name||x.creatureId)}</span><small>${x.gainXp>0?'+':''}${x.gainXp||0} XP</small></div>`).join('')||'<p>Пока тихо…</p>';
}
function esc(x){return String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
socket.on('stats',render); socket.on('joinConfig', c=>refreshJoin(c.version||c.qrVersion));
fetch('/api/stats').then(r=>r.json()).then(render); fetch('/api/join-config').then(r=>r.json()).then(c=>refreshJoin(c.qrVersion));
