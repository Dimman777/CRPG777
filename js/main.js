import { Game } from './game.js';

// Expose the game instance globally so the start screen (index.html inline
// module script) can call window._game.start(opts) once a world is chosen.
window._game = new Game();
