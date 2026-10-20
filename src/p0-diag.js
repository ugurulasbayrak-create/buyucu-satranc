window.addEventListener('error', function (e) {
  var c = document.getElementById('chipText');
  if (c) c.textContent = 'Hata: ' + e.message + ' [satir ' + e.lineno + ']';
});
window.addEventListener('unhandledrejection', function (e) {
  var c = document.getElementById('chipText');
  if (c) c.textContent = 'Hata: ' + (e.reason && e.reason.message || e.reason);
});
