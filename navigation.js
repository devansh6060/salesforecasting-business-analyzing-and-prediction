(function () {
  'use strict';
  const menu = document.getElementById('workspaceNavigation');
  menu.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !event.target.matches('.nav')) return;
    const buttons = [...menu.querySelectorAll('.nav')].filter(button => !button.disabled && !button.hidden && !button.classList.contains('hidden'));
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index].focus();
    buttons[index].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
  document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => {
    button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => Object.values(charts).forEach(chart => { if (typeof chart.resize === 'function') chart.resize(); }));
  }));
  document.querySelector('.workspace-brand').addEventListener('click', event => { event.preventDefault(); document.querySelector('.nav[data-view="dashboard"]').click(); });
})();
