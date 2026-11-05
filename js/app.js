import { createGame } from "./engine.js";
import { createUI } from "./ui.js";

// Player actions and API calls share this engine and the UI's rendering path.
const game = createGame();
const ui = createUI(game);
const testMode = new URLSearchParams(window.location.search).getAll("test").includes("1");

if (testMode) {
  // createUI has rendered the initial not-started state before exposure.
  window.codeSecretTest = {
    version: "0.2",
    getConfig: game.getConfig,
    startGame: ui.startGame,
    submitGuess: ui.submitGuess,
    getState: game.getState,
  };
} else {
  await ui.startGame();
}
