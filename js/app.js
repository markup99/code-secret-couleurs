import { createGame } from "./engine.js";
import { createUI } from "./ui.js";

// Keep one engine instance for the UI and the future API adapter.
const game = createGame();
const ui = createUI(game);
await ui.startGame();
