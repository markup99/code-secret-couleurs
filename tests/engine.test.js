import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../js/engine.js";

const R = "rouge", B = "bleu", V = "vert", J = "jaune", O = "orange", Vi = "violet";
const REDS = [R, R, R, R];
const BLUES = [B, B, B, B];
const freshState = (status) => ({
  status, attempts: 0, history: [], lastGuess: null, lastResult: null, lastError: null,
});

// Expected values transcribed from contract 0.2, section 5, before execution.
const examples = [
  ["T01", [R, B, V, J], [R, V, B, O], 1, 2],
  ["T02", [R, B, V, J], [O, Vi, R, B], 0, 2],
  ["T03", [R, B, V, J], [B, R, J, V], 0, 4],
  ["T04", [R, B, V, J], [R, B, J, V], 2, 2],
  ["T05", [R, B, V, J], [R, B, V, J], 4, 0],
  ["T06", [R, R, B, V], [R, R, R, R], 2, 0],
  ["T07", [R, R, B, V], [R, B, R, V], 2, 2],
  ["T08", [R, R, B, V], [R, R, B, V], 4, 0],
  ["T09", [R, R, B, V], [R, B, R, R], 1, 2],
];

for (const [id, secret, guess, wellPlaced, misplaced] of examples) {
  test(`${id}: expected ${wellPlaced}/${misplaced}, one attempt and matching history`, async () => {
    const game = createGame();
    await game.startGame({ secret });
    const result = { wellPlaced, misplaced };
    assert.deepEqual(await game.submitGuess(guess), {
      status: wellPlaced === 4 ? "won" : "playing",
      attempts: 1, history: [{ guess, result }],
      lastGuess: guess, lastResult: result, lastError: null,
    });
  });
}

test("initial state and exact contract configuration; getters are synchronous", () => {
  const game = createGame();
  assert.deepEqual(game.getState(), freshState("not-started"));
  assert.deepEqual(game.getConfig(), {
    apiVersion: "0.2", rulesVersion: "code-couleurs-1.0",
    secretLength: 4, maxAttempts: 10, allowDuplicates: true,
    colors: [R, B, V, J, O, Vi],
  });
});

test("before start, game-not-started takes priority over invalid-type", async () => {
  const game = createGame();
  const state = await game.submitGuess(null);
  assert.equal(state.lastError.code, "game-not-started");
  assert.deepEqual({ ...state, lastError: null }, freshState("not-started"));
});

const invalidGuesses = [
  ["null", null, "invalid-type"],
  ["string", R, "invalid-type"],
  ["array-like object", { 0: R, length: 4 }, "invalid-type"],
  ["missing entries", new Array(4), "invalid-type"],
  ["hole among strings", [R, , B, V], "invalid-type"],
  ["non-string before wrong length", [R, null], "invalid-type"],
  ["explicit undefined", [R, B, V, undefined], "invalid-type"],
  ["empty", [], "invalid-length"],
  ["incomplete", [R], "invalid-length"],
  ["too long", [R, B, V, J, O], "invalid-length"],
  ["length before unknown color", ["purple"], "invalid-length"],
  ["uppercase", [R, B, V, "Violet"], "invalid-color"],
  ["space", [R, B, V, "violet "], "invalid-color"],
  ["translation", [R, B, V, "purple"], "invalid-color"],
];
for (const [label, guess, code] of invalidGuesses) {
  test(`invalid guess (${label}): ${code}, only lastError changes`, async () => {
    const game = createGame();
    await game.startGame({ secret: REDS });
    await game.submitGuess(BLUES);
    const before = game.getState();
    const after = await game.submitGuess(guess);
    assert.equal(after.lastError.code, code);
    assert.ok(after.lastError.message.length > 0);
    assert.deepEqual({ ...after, lastError: null }, before);
    assert.deepEqual(game.getState(), after);
  });
}

const invalidStarts = [
  ["null options", null, "invalid-options"],
  ["array options", [], "invalid-options"],
  ["string options", "secret", "invalid-options"],
  ["number options", 1, "invalid-options"],
  ["function options", () => {}, "invalid-options"],
  ["non-plain object", new Date(0), "invalid-options"],
  ["unknown key before invalid secret", { extra: true, secret: null }, "invalid-options"],
  ["non-enumerable unknown key", Object.defineProperty({}, "extra", { value: true }), "invalid-options"],
  ["symbol key", { [Symbol("extra")]: true }, "invalid-options"],
  ["undefined secret", { secret: undefined }, "invalid-type"],
  ["null secret", { secret: null }, "invalid-type"],
  ["sparse secret", { secret: new Array(4) }, "invalid-type"],
  ["type before length", { secret: [R, null] }, "invalid-type"],
  ["short secret", { secret: [R] }, "invalid-length"],
  ["unknown color", { secret: [R, R, R, "purple"] }, "invalid-color"],
];
for (const [label, options, code] of invalidStarts) {
  test(`invalid start (${label}): rejects ${code}, entire state unchanged`, async () => {
    const game = createGame();
    await game.startGame({ secret: REDS });
    await game.submitGuess(BLUES);
    await game.submitGuess([]);
    const before = game.getState();
    const promise = game.startGame(options);
    assert.ok(promise instanceof Promise);
    await assert.rejects(promise, (error) =>
      error instanceof Error && error.code === code && error.message.length > 0);
    assert.deepEqual(game.getState(), before);
    assert.equal((await game.submitGuess(REDS)).status, "won");
  });
}

test("nine misses, invalid guess, then victory on attempt ten", async () => {
  const game = createGame();
  await game.startGame({ secret: REDS });
  for (let attempt = 1; attempt <= 9; attempt += 1) {
    const state = await game.submitGuess(BLUES);
    assert.equal(state.status, "playing");
    assert.equal(state.attempts, attempt);
    assert.equal(state.history.length, attempt);
    assert.deepEqual(state.lastResult, { wellPlaced: 0, misplaced: 0 });
  }
  const refused = await game.submitGuess([R]);
  assert.equal(refused.lastError.code, "invalid-length");
  assert.equal(refused.attempts, 9);
  const won = await game.submitGuess(REDS);
  assert.equal(won.status, "won");
  assert.equal(won.attempts, 10);
  assert.equal(won.history.length, 10);
  assert.deepEqual(won.lastResult, { wellPlaced: 4, misplaced: 0 });
  assert.equal(won.lastError, null);
});

async function finish(game, outcome) {
  await game.startGame({ secret: REDS });
  if (outcome === "won") return game.submitGuess(REDS);
  for (let attempt = 0; attempt < 10; attempt += 1) await game.submitGuess(BLUES);
  const state = game.getState();
  assert.equal(state.status, "lost");
  assert.equal(state.attempts, 10);
  assert.equal(state.history.length, 10);
  assert.deepEqual(state.lastResult, { wellPlaced: 0, misplaced: 0 });
  return state;
}

for (const outcome of ["won", "lost"]) {
  test(`${outcome}: further guesses refused; invalid start preserves state; restart resets all fields`, async () => {
    const game = createGame();
    const before = await finish(game, outcome);
    for (const guess of [REDS, null]) {
      const after = await game.submitGuess(guess);
      assert.equal(after.lastError.code, "game-finished");
      assert.deepEqual({ ...after, lastError: null }, before);
    }
    const finished = game.getState();
    await assert.rejects(game.startGame({ secret: [] }), { code: "invalid-length" });
    assert.deepEqual(game.getState(), finished);
    assert.deepEqual(await game.startGame({ secret: BLUES }), freshState("playing"));
    assert.equal((await game.submitGuess(BLUES)).status, "won");
  });
}

test("restart while playing clears history and lastError", async () => {
  const game = createGame();
  await game.startGame({ secret: REDS });
  await game.submitGuess(BLUES);
  await game.submitGuess(null);
  assert.deepEqual(await game.startGame({ secret: BLUES }), freshState("playing"));
  assert.equal((await game.submitGuess(BLUES)).status, "won");
});

test("invalid start before playing preserves not-started; valid start clears previous refusal", async () => {
  const game = createGame();
  await game.submitGuess(null);
  const before = game.getState();
  await assert.rejects(game.startGame(null), { code: "invalid-options" });
  assert.deepEqual(game.getState(), before);
  assert.deepEqual(await game.startGame({ secret: REDS }), freshState("playing"));
});

test("inputs and returned nested objects cannot mutate internal state; no secret is exposed", async () => {
  const game = createGame();
  const secret = [...REDS];
  const start = game.startGame({ secret });
  secret.fill(B);
  (await start).status = "lost";
  const guess = [R, B, B, B];
  const pending = game.submitGuess(guess);
  guess.fill(V);
  const returned = await pending;
  const before = game.getState();
  assert.deepEqual(before.lastGuess, [R, B, B, B]);
  assert.deepEqual(before.lastResult, { wellPlaced: 1, misplaced: 0 });
  returned.history[0].guess.fill(V);
  returned.history[0].result.wellPlaced = 4;
  returned.lastGuess.fill(V);
  returned.lastResult.misplaced = 4;
  returned.history.push({});
  const config = game.getConfig();
  config.colors.fill("purple");
  config.maxAttempts = 1;
  assert.deepEqual(game.getState(), before);
  assert.deepEqual(game.getConfig().colors, [R, B, V, J, O, Vi]);
  assert.equal(game.getConfig().maxAttempts, 10);
  await game.submitGuess(null);
  const errorState = game.getState();
  errorState.lastError.code = "changed";
  assert.equal(game.getState().lastError.code, "invalid-type");
  assert.equal((await game.submitGuess(REDS)).status, "won");
  for (const state of [before, game.getState()]) {
    assert.equal(Object.hasOwn(state, "secret"), false);
    assert.equal(Object.hasOwn(state, "solution"), false);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  }
});

test("two game instances remain independent", async () => {
  const first = createGame();
  const second = createGame();
  await first.startGame({ secret: REDS });
  assert.deepEqual(second.getState(), freshState("not-started"));
  await second.startGame({ secret: BLUES });
  assert.equal((await first.submitGuess(REDS)).status, "won");
  assert.equal((await second.submitGuess(REDS)).status, "playing");
});

test("random starts: all palette entries reachable, duplicates allowed, defaults equivalent", async (t) => {
  // Controlled draws verify generation without probabilistic pass/fail criteria.
  let draw = 0;
  t.mock.method(Math, "random", () => draw);
  const game = createGame();
  const colors = game.getConfig().colors;
  for (let index = 0; index < colors.length; index += 1) {
    draw = (index + 0.5) / colors.length;
    assert.deepEqual(await game.startGame(), freshState("playing"));
    assert.equal((await game.submitGuess(Array(4).fill(colors[index]))).status, "won");
  }
  draw = 0;
  for (const options of [undefined, {}, Object.create(null)]) {
    assert.deepEqual(await game.startGame(options), freshState("playing"));
    assert.equal((await game.submitGuess(REDS)).status, "won");
  }
  // A new random game must not retain a previously imposed secret.
  await game.startGame({ secret: BLUES });
  await game.startGame();
  assert.equal((await game.submitGuess(REDS)).status, "won");
});
