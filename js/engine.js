// Sources: project edition 2.1, rules code-couleurs-1.0, API contract 0.2.
const COLORS = ["rouge", "bleu", "vert", "jaune", "orange", "violet"];
const SECRET_LENGTH = 4;
const MAX_ATTEMPTS = 10;

const MESSAGES = {
  "game-not-started": "Commencez une nouvelle partie avant de proposer un code.",
  "game-finished": "La partie est terminée. Commencez une nouvelle partie.",
  "invalid-options": "Les options doivent être un objet contenant uniquement la clé secret, facultative.",
  "invalid-type": "Le code doit être un tableau de chaînes, sans élément absent.",
  "invalid-length": "Le code doit contenir exactement quatre couleurs.",
  "invalid-color": "La couleur proposée n’est pas autorisée.",
};

function emptyState(status) {
  return {
    status, attempts: 0, history: [],
    lastGuess: null, lastResult: null, lastError: null,
  };
}

// Check every position before length: Array.every() would skip missing elements.
function validateCode(code) {
  if (!Array.isArray(code)) return "invalid-type";
  for (let index = 0; index < code.length; index += 1) {
    if (!Object.hasOwn(code, index) || typeof code[index] !== "string") {
      return "invalid-type";
    }
  }
  if (code.length !== SECRET_LENGTH) return "invalid-length";
  if (code.some((color) => !COLORS.includes(color))) return "invalid-color";
  return null;
}

function validateOptions(options) {
  if (options === null || typeof options !== "object") return "invalid-options";
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) return "invalid-options";
  if (Reflect.ownKeys(options).some((key) => key !== "secret")) return "invalid-options";
  return Object.hasOwn(options, "secret") ? validateCode(options.secret) : null;
}

function score(secret, guess) {
  let wellPlaced = 0;
  let misplaced = 0;
  const remaining = new Map();

  // Reserve exact matches before counting any misplaced occurrences.
  for (let index = 0; index < SECRET_LENGTH; index += 1) {
    if (secret[index] === guess[index]) wellPlaced += 1;
    else remaining.set(secret[index], (remaining.get(secret[index]) ?? 0) + 1);
  }
  for (let index = 0; index < SECRET_LENGTH; index += 1) {
    if (secret[index] === guess[index]) continue;
    const available = remaining.get(guess[index]) ?? 0;
    if (available > 0) {
      misplaced += 1;
      remaining.set(guess[index], available - 1);
    }
  }
  return { wellPlaced, misplaced };
}

/**
 * Create one independent game. Share this same instance between UI and API.
 * No DOM, browser globals, storage or network access is used here.
 * Mutations return promises; the future application layer must also await
 * rendering before resolving its public API calls.
 */
export function createGame() {
  let secret = null;
  let state = emptyState("not-started");

  function getConfig() {
    return {
      apiVersion: "0.2", rulesVersion: "code-couleurs-1.0",
      secretLength: SECRET_LENGTH, maxAttempts: MAX_ATTEMPTS,
      allowDuplicates: true, colors: [...COLORS],
    };
  }

  function getState() {
    return {
      ...state,
      history: state.history.map(({ guess, result }) => ({
        guess: [...guess], result: { ...result },
      })),
      lastGuess: state.lastGuess === null ? null : [...state.lastGuess],
      lastResult: state.lastResult === null ? null : { ...state.lastResult },
      lastError: state.lastError === null ? null : { ...state.lastError },
    };
  }

  async function startGame(options = {}) {
    const code = validateOptions(options);
    if (code !== null) {
      const error = new Error(MESSAGES[code]);
      error.code = code;
      throw error;
    }
    secret = Object.hasOwn(options, "secret")
      ? [...options.secret]
      : Array.from({ length: SECRET_LENGTH }, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
    state = emptyState("playing");
    return getState();
  }

  async function submitGuess(guess) {
    let code;
    if (state.status === "not-started") code = "game-not-started";
    else if (state.status === "won" || state.status === "lost") code = "game-finished";
    else code = validateCode(guess);

    if (code !== null) {
      state.lastError = { code, message: MESSAGES[code] };
      return getState();
    }

    const savedGuess = [...guess];
    const result = score(secret, savedGuess);
    state.history.push({ guess: savedGuess, result });
    state.attempts = state.history.length;
    state.lastGuess = savedGuess;
    state.lastResult = result;
    state.lastError = null;
    if (result.wellPlaced === SECRET_LENGTH) state.status = "won";
    else if (state.attempts === MAX_ATTEMPTS) state.status = "lost";
    return getState();
  }

  return { getConfig, getState, startGame, submitGuess };
}
