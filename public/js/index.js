const nick = document.querySelector('#nick');
nick.value = localStorage.getItem('partygo_name') || '';

document.querySelector('#play').onclick = async () => {
  const name = nick.value.trim();
  if (!name) { nick.focus(); return; }
  const button = document.querySelector('#play');
  button.disabled = true;
  button.textContent = 'ЗАГРУЗКА…';
  try {
    let id = localStorage.getItem('partygo_id') || '';
    const r = await fetch('/api/join', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id,name})
    });
    if (!r.ok) throw new Error('Не удалось войти');
    const p = await r.json();
    localStorage.setItem('partygo_id', p.id);
    localStorage.setItem('partygo_name', p.name);
    location.href = '/play.html';
  } catch (e) {
    button.disabled = false;
    button.textContent = '🎮 НАЧАТЬ ИГРУ';
    alert('Не удалось войти в игру. Проверь Wi-Fi и адрес сервера.');
  }
};
