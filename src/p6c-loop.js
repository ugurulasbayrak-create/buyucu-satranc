/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
  updateCamera(dt, now);
  const sdt = dt * timeScale;
  updateTweens(sdt); updateBursts(sdt);
  for (let i = 0; i < animators.length; i++) animators[i](time, sdt);
  if (!reduced) {
    pieces.forEach(g => { const a = g.userData.anim; for (let i = 0; i < a.length; i++) a[i](time); });
    if (selectedGroup && !animating) selectedGroup.position.y = 0.14 + Math.sin(time * 4) * 0.03;
    [markerGroup, hintGroup].forEach(grp => grp.children.forEach(m => { if (m.userData.kind !== 'sel') m.scale.setScalar(1 + 0.12 * Math.sin(time * 4 + m.userData.ph)); }));
  } else {
    if (selectedGroup && !animating) selectedGroup.position.y = 0.14;
  }
  if (checkSq) sqMesh[checkSq].material.emissive.copy(C('#b01515')).multiplyScalar(0.55 + 0.45 * Math.sin(time * 5));
  renderFrame(dt);
  requestAnimationFrame(frame);
}

/* ---------- start ---------- */
camera.aspect = 1;
camTarget.copy(camTargetT);
setCam('player');
cam.theta = camT.theta; cam.phi = camT.phi; cam.radius = camT.radius;
placeCamera(0);
bakeEnvironment();
initPost();
newGame();
openHome();
requestAnimationFrame(frame);
})();
