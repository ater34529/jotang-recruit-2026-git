/* 在样式加载前应用主题，避免刷新时闪白。 */
(function () {
  var theme = 'dark';
  try {
    var raw = localStorage.getItem('jotang-ai:settings:v1');
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && saved.theme === 'light') theme = 'light';
    }
  } catch (e) {
    /* localStorage 不可用时保持默认深色 */
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
