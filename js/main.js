import { Game } from './game.js';
import { VERSION } from './core/version.js';

// Expose the game instance globally so the start screen (index.html inline
// module script) can call window._game.start(opts) once a world is chosen.
window._game = new Game();

// Version stamp — bottom-right corner, verifiable at a glance.
const el = document.getElementById('version-stamp');
if (el) el.textContent = `${VERSION.label} ${VERSION.hash} (${VERSION.date})`;
