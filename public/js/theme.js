(() => {
  const applyTheme = theme => {
    const safe = theme === 'books' ? 'books' : '2016';
    document.body.dataset.theme = safe;
    document.documentElement.dataset.theme = safe;
    document.querySelectorAll('[data-theme-label]').forEach(el => {
      const mode = el.dataset.themeLabel;
      el.hidden = mode !== safe;
    });
    const eyebrow = document.querySelector('.theme-eyebrow');
    if (eyebrow) eyebrow.textContent = safe === 'books'
      ? 'ЛОКАЛЬНАЯ ИГРА // КНИЖНЫЙ ВЕЧЕР'
      : 'ЛОКАЛЬНАЯ ИГРА // ВЕЧЕРИНКА 2К16';
  };
  window.applyPartyTheme = applyTheme;
  fetch('/api/theme', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(x => applyTheme(x.theme))
    .catch(() => applyTheme('2016'));
  if (window.io) {
    try {
      const socket = window.partyGoSocket || (window.partyGoSocket = io());
      socket.on('themeConfig', x => applyTheme(x.theme));
    } catch (_) {}
  }
})();
