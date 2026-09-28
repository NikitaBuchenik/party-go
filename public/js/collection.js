(async()=>{
  const id=localStorage.getItem('partygo_id'); if(!id)return location.href='/';
  try {
    const [s,cs]=await Promise.all([
      fetch('/api/stats',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/creatures',{cache:'no-store'}).then(r=>r.json())
    ]);
    const p=s.players.find(x=>x.id===id);
    document.querySelector('#who').textContent=p?.name||'ИГРОК';
    document.querySelector('#collectionCount').textContent=`${(p?.capturedIds||[]).filter(x=>cs.find(c=>c.id===x)?.type!=='bonus').length}/${cs.filter(c=>c.type!=='bonus').length}`;
    const caught=new Set(p?.capturedIds||[]);
    const card=c=>{
      const ok=caught.has(c.id);
      const image=c.image || `/images/${encodeURIComponent(c.id)}.jpg`;
      const rarity=c.rarity==='ЛЕГЕНДАРНЫЙ'?'legendary':c.rarity==='РЕДКИЙ'?'rare':'';
      return `<article class="creature-card ${ok?'':'locked'} ${rarity}"><img src="${esc(image)}" alt="${esc(ok?c.name:'???')}" onerror="this.style.display='none'"><div><b>${esc(ok?c.name:'???')}</b><small>${esc(ok?`${c.rarity} · ${c.xp} XP`:'НЕ НАЙДЕНО')}</small></div></article>`;
    };
    const bonusCard=c=>{
      const ok=caught.has(c.id); const image=c.image;
      return `<article class="creature-card bonus-card ${ok?'':'locked'}"><img src="${esc(image)}" alt="${esc(ok?c.name:'???')}" onerror="this.style.display='none'"><div><b>${esc(ok?c.name:'???')}</b><small>${esc(ok?(c.effectText||'БОНУС'):'БОНУС НЕ НАЙДЕН')}</small></div></article>`;
    };
    const normal=cs.filter(c=>c.type!=='bonus'&&(c.tier||'normal')==='normal');
    const rare=cs.filter(c=>c.type!=='bonus'&&c.tier==='rare');
    const legendary=cs.filter(c=>c.type!=='bonus'&&c.tier==='legendary');
    const bonuses=cs.filter(c=>c.type==='bonus');
    document.querySelector('#normalCollection').innerHTML=normal.map(card).join('')||'<p class="empty-tier">Пока пусто</p>';
    document.querySelector('#rareCollection').innerHTML=rare.map(card).join('')||'<p class="empty-tier">Пока пусто</p>';
    document.querySelector('#legendaryCollection').innerHTML=legendary.map(card).join('')||'<p class="empty-tier">Пока пусто</p>';
    document.querySelector('#bonusCollection').innerHTML=bonuses.map(bonusCard).join('')||'<p class="empty-tier">Бонусов пока нет.</p>';
  } catch(e) { console.error(e); }
  function esc(x){return String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
})();
