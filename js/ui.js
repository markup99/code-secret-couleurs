// Presentation only: validation, scoring and game state belong to engine.js.
export function createUI(game) {
  const config = game.getConfig();
  const form = document.querySelector("#guess-form");
  const fields = document.querySelector("#guess-fields");
  const positions = document.querySelector("#positions");
  const restart = document.querySelector("#new-game");
  const message = document.querySelector("#message");
  const history = document.querySelector("#history");
  const remaining = document.querySelector("#remaining");
  const emptyHistory = document.querySelector("#empty-history");
  const selects = [];
  let busy = false;

  function swatch(color) {
    const dot = document.createElement("span");
    dot.className = "swatch";
    dot.dataset.color = color;
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }

  for (const color of config.colors) {
    const item = document.createElement("li");
    item.append(swatch(color), document.createTextNode(color));
    document.querySelector("#palette").append(item);
  }

  for (let index = 0; index < config.secretLength; index += 1) {
    const label = document.createElement("label");
    label.className = "position";
    const caption = document.createElement("span");
    caption.textContent = `Position ${index + 1}`;
    const dot = swatch("");
    const select = document.createElement("select");
    select.name = `position-${index + 1}`;
    select.add(new Option("Choisir…", ""));
    for (const color of config.colors) select.add(new Option(color, color));
    select.addEventListener("change", () => {
      dot.dataset.color = select.value;
      select.removeAttribute("aria-invalid");
    });
    label.append(caption, dot, select);
    positions.append(label);
    selects.push(select);
  }

  function render(state) {
    // Rendering completes an operation: controls must be ready before return.
    fields.disabled = state.status !== "playing";
    restart.disabled = false;
    remaining.textContent = `${config.maxAttempts - state.attempts} / ${config.maxAttempts} essais restants`;
    emptyHistory.hidden = state.history.length > 0;
    history.replaceChildren();
    state.history.forEach(({ guess, result }, index) => {
      const row = document.createElement("li");
      const number = document.createElement("strong");
      number.className = "attempt-number";
      number.textContent = `Essai ${index + 1}`;
      const colors = document.createElement("ol");
      colors.className = "guess-colors";
      colors.setAttribute("aria-label", "Couleurs dans l’ordre");
      for (const color of guess) {
        const item = document.createElement("li");
        item.append(swatch(color), document.createTextNode(color));
        colors.append(item);
      }
      const feedback = document.createElement("p");
      feedback.className = "feedback";
      feedback.textContent = `${result.wellPlaced} bien placée(s) · ${result.misplaced} mal placée(s)`;
      row.append(number, colors, feedback);
      history.append(row);
    });

    message.dataset.kind = state.lastError ? "error" : state.status;
    if (state.lastError) {
      message.textContent = state.lastError.message;
    } else if (state.status === "not-started") {
      message.textContent = "Cliquez sur Nouvelle partie pour commencer.";
    } else if (state.status === "won") {
      message.textContent = `Bravo ! Vous avez trouvé le code secret en ${state.attempts} essai(s).`;
    } else if (state.status === "lost") {
      message.textContent = `Partie terminée : vous avez utilisé les ${config.maxAttempts} essais. Réessayez avec une nouvelle partie !`;
    } else if (state.lastResult) {
      message.textContent = `Essai ${state.attempts} : ${state.lastResult.wellPlaced} bien placée(s), ${state.lastResult.misplaced} mal placée(s). À vous de poursuivre !`;
    } else {
      message.textContent = "La partie commence ! Composez votre première proposition.";
    }
  }

  async function startGame(options) {
    // Validate in the engine first. A rejected start must leave the DOM,
    // selections, focus and previous lastError completely untouched.
    const state = await game.startGame(options);
    form.reset();
    for (const select of selects) {
      select.removeAttribute("aria-invalid");
      select.dispatchEvent(new Event("change"));
    }
    render(state);
    selects[0].focus();
    return state;
  }

  async function submitGuess(guess) {
    const state = await game.submitGuess(guess);
    render(state);
    return state;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || game.getState().status !== "playing") return;
    busy = true;
    fields.disabled = true;
    restart.disabled = true;
    try {
      const state = await submitGuess(selects.map((select) => select.value));
      busy = false;
      if (state.lastError) {
        const firstEmpty = selects.find((select) => select.value === "");
        if (firstEmpty) {
          message.textContent = "Proposition incomplète : choisissez les quatre couleurs. Aucun essai consommé.";
        }
        for (const select of selects) {
          if (select.value === "") select.setAttribute("aria-invalid", "true");
        }
        (firstEmpty ?? selects[0]).focus();
      } else if (state.status !== "playing") {
        restart.focus();
      } else {
        selects[0].focus();
      }
    } catch (error) {
      console.error(error);
      message.textContent = "Impossible de valider la proposition. Veuillez réessayer.";
      message.dataset.kind = "error";
    } finally {
      busy = false;
      fields.disabled = game.getState().status !== "playing";
      restart.disabled = false;
    }
  });
  restart.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    try {
      // Do not pass the click event as startGame options.
      await startGame();
    } catch (error) {
      console.error(error);
      message.textContent = "Impossible de démarrer la partie. Cliquez sur Nouvelle partie pour réessayer.";
      message.dataset.kind = "error";
    } finally {
      busy = false;
      fields.disabled = game.getState().status !== "playing";
      restart.disabled = false;
    }
  });

  render(game.getState());
  return { startGame, submitGuess };
}
