// Kütüphaneleri www/libs içine indirir (internet gerekir, bir kez çalıştırman yeter).
import { writeFileSync, mkdirSync } from 'node:fs';
const J = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const files = {
  'firebase-app-compat.js': FB + 'firebase-app-compat.js',
  'firebase-auth-compat.js': FB + 'firebase-auth-compat.js',
  'firebase-firestore-compat.js': FB + 'firebase-firestore-compat.js',
  'three.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'chess.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.2/chess.min.js',
  'CopyShader.js': J + 'shaders/CopyShader.js',
  'LuminosityHighPassShader.js': J + 'shaders/LuminosityHighPassShader.js',
  'EffectComposer.js': J + 'postprocessing/EffectComposer.js',
  'RenderPass.js': J + 'postprocessing/RenderPass.js',
  'ShaderPass.js': J + 'postprocessing/ShaderPass.js',
  'UnrealBloomPass.js': J + 'postprocessing/UnrealBloomPass.js'
};
mkdirSync('www/libs', { recursive: true });
for (const [name, url] of Object.entries(files)) {
  const r = await fetch(url); if (!r.ok) throw new Error(name + ' indirilemedi: ' + r.status);
  writeFileSync('www/libs/' + name, Buffer.from(await r.arrayBuffer())); console.log('ok', name);
}
