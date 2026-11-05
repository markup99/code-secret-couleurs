import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, test } from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const prefix = "/code-secret-couleurs/";
const R = "rouge", B = "bleu", V = "vert", J = "jaune", O = "orange", Vi = "violet";
const reds = [R, R, R, R], blues = [B, B, B, B];
const fresh = (status = "playing") => ({
  status, attempts: 0, history: [], lastGuess: null, lastResult: null, lastError: null,
});
let server, browser, page, url;
let browserErrors;

before(async () => {
  // Serve the real files under a repository subpath, without a build or backend.
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (!pathname.startsWith(prefix)) throw new Error("Unknown route");
      const relative = pathname.slice(prefix.length) || "index.html";
      const file = new URL(relative, root);
      if (!file.href.startsWith(root.href)) throw new Error("Outside repository");
      const content = await readFile(fileURLToPath(file));
      const type = file.pathname.endsWith(".js") ? "text/javascript"
        : file.pathname.endsWith(".css") ? "text/css" : "text/html";
      response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
beforeEach(async () => {
  page = await browser.newPage();
  browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    window.checkUI = (state) => {
      const check = (condition, description) => { if (!condition) throw new Error(description); };
      check(document.querySelector("#remaining").textContent === `${10 - state.attempts} / 10 essais restants`, "remaining attempts");
      const rows = [...document.querySelectorAll("#history > li")];
      check(rows.length === state.history.length, "history length");
      state.history.forEach(({ guess, result }, index) => {
        const colors = [...rows[index].querySelectorAll(".guess-colors li")].map((el) => el.textContent);
        check(JSON.stringify(colors) === JSON.stringify(guess), "ordered history colours");
        check(rows[index].querySelector(".feedback").textContent === `${result.wellPlaced} bien placée(s) · ${result.misplaced} mal placée(s)`, "history feedback");
      });
      check(document.querySelector("#empty-history").hidden === (rows.length > 0), "empty history visibility");
      check(document.querySelector("#guess-fields").disabled === (state.status !== "playing"), "play controls readiness");
      check(!document.querySelector("#new-game").disabled, "restart readiness");
      const message = document.querySelector("#message");
      check(message.textContent.length > 0, "nonempty message");
      if (state.lastError && state.status === "playing") {
        check(message.dataset.kind === "error", "visible refusal");
      } else if (!state.lastError) {
        check(message.dataset.kind === state.status, "visible status");
        if (state.status === "won") check(message.textContent.includes("Bravo"), "victory message");
        if (state.status === "lost") check(message.textContent.includes("Partie terminée"), "defeat message");
      }
      check(!("secret" in state) && !("solution" in state), "no secret exposed");
      check(JSON.stringify(window.codeSecretTest.getState()) === JSON.stringify(state), "returned/current state agreement");
      return state;
    };
    window.callAPI = async (method, ...args) => {
      const pending = window.codeSecretTest[method](...args);
      if (!(pending instanceof Promise)) throw new Error("Mutation must return a Promise");
      // No timer, animation frame or polling after resolution: the DOM must
      // already match the returned state and be ready for the next action.
      const state = window.checkUI(await pending);
      if (state.lastError && state.status === "playing"
          && document.querySelector("#message").textContent !== state.lastError.message) {
        throw new Error("API refusal message must describe the submitted input");
      }
      return state;
    };
    window.screenSnapshot = () => ({
      html: document.querySelector("main").innerHTML,
      selections: [...document.querySelectorAll("select")].map((select) => select.value),
      focus: document.activeElement?.outerHTML,
    });
  });
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => window.codeSecretTest !== undefined);
});
afterEach(async () => {
  assert.deepEqual(browserErrors, [], "no browser exceptions or failed asset requests");
  await page.close();
});

const start = (secret = reds) => page.evaluate((secret) => window.callAPI("startGame", { secret }), secret);
const guess = (value) => page.evaluate((value) => window.callAPI("submitGuess", value), value);

test("version, exact synchronous config/state, initial not-started UI and getter purity", async () => {
  const result = await page.evaluate(() => {
    const api = window.codeSecretTest;
    const screen = window.screenSnapshot();
    const config = api.getConfig(), state = api.getState();
    window.checkUI(state);
    return { version: api.version, config, state,
      sync: !(config instanceof Promise) && !(state instanceof Promise),
      unchanged: JSON.stringify(screen) === JSON.stringify(window.screenSnapshot()),
      methods: Object.keys(api).sort() };
  });
  assert.equal(result.version, "0.2");
  assert.equal(result.sync, true);
  assert.equal(result.unchanged, true);
  assert.deepEqual(result.methods, ["getConfig", "getState", "startGame", "submitGuess", "version"]);
  assert.deepEqual(result.config, { apiVersion: "0.2", rulesVersion: "code-couleurs-1.0",
    secretLength: 4, maxAttempts: 10, allowDuplicates: true, colors: [R, B, V, J, O, Vi] });
  assert.deepEqual(result.state, fresh("not-started"));
});

test("before start, game-not-started precedes validation and consumes no attempt", async () => {
  const state = await guess(null);
  assert.equal(state.lastError.code, "game-not-started");
  assert.deepEqual({ ...state, lastError: null }, fresh("not-started"));
});

// Contract 0.2 §5: expected values transcribed before running the tests.
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
for (const [id, secret, proposal, wellPlaced, misplaced] of examples) {
  test(`${id}: ${wellPlaced}/${misplaced}, one attempt, matching state and visible history`, async () => {
    assert.deepEqual(await start(secret), fresh());
    const result = { wellPlaced, misplaced };
    assert.deepEqual(await guess(proposal), {
      status: wellPlaced === 4 ? "won" : "playing", attempts: 1,
      history: [{ guess: proposal, result }], lastGuess: proposal, lastResult: result, lastError: null,
    });
  });
}

// Expressions are fixed test fixtures, evaluated in the page's realm to
// preserve undefined, holes, symbols and prototypes across the browser boundary.
const invalidGuesses = [
  ["undefined", "invalid-type"], ["null", "invalid-type"], ['"rouge"', "invalid-type"],
  ['({0:"rouge", length:4})', "invalid-type"], ["new Array(4)", "invalid-type"],
  ['["rouge", , "bleu", "vert"]', "invalid-type"], ['["rouge", null]', "invalid-type"],
  ['["rouge", "bleu", "vert", undefined]', "invalid-type"],
  ["[]", "invalid-length"], ['["rouge"]', "invalid-length"], ['["purple"]', "invalid-length"],
  ['["rouge","bleu","vert","jaune","orange"]', "invalid-length"],
  ['["rouge","bleu","vert","Violet"]', "invalid-color"],
  ['["rouge","bleu","vert","violet "]', "invalid-color"],
  ['["rouge","bleu","vert","purple"]', "invalid-color"],
];
for (const [expression, code] of invalidGuesses) {
  test(`invalid guess ${expression}: ${code}; only lastError changes, visible refusal`, async () => {
    await start();
    const before = await guess(blues);
    const after = await page.evaluate(({ expression }) => window.callAPI("submitGuess", (0, eval)(expression)), { expression });
    assert.equal(after.lastError.code, code);
    assert.ok(after.lastError.message.length > 0);
    assert.deepEqual({ ...after, lastError: null }, before);
  });
}

const invalidStarts = [
  ["null", "invalid-options"], ["[]", "invalid-options"], ['"secret"', "invalid-options"],
  ["1", "invalid-options"], ["(() => {})", "invalid-options"], ["new Date(0)", "invalid-options"],
  ["({extra:true,secret:null})", "invalid-options"],
  ['Object.defineProperty({},"extra",{value:true})', "invalid-options"],
  ['({[Symbol("extra")]:true})', "invalid-options"],
  ["({secret:undefined})", "invalid-type"], ["({secret:null})", "invalid-type"],
  ["({secret:new Array(4)})", "invalid-type"], ['({secret:["rouge",null]})', "invalid-type"],
  ['({secret:["rouge"]})', "invalid-length"],
  ['({secret:["rouge","bleu","vert","purple"]})', "invalid-color"],
];
for (const [expression, code] of invalidStarts) {
  test(`invalid start ${expression}: rejects ${code}, entire state and UI unchanged`, async () => {
    await start();
    await guess(blues);
    await guess(null); // Preserve an existing lastError as well as history.
    await page.locator("select").first().selectOption(Vi);
    await page.locator("select").first().focus();
    const result = await page.evaluate(async ({ expression }) => {
      const api = window.codeSecretTest;
      const before = api.getState(), screen = window.screenSnapshot();
      let caught = null;
      try { await api.startGame((0, eval)(expression)); }
      catch (error) { caught = { isError: error instanceof Error, code: error.code, message: error.message }; }
      return { before, after: api.getState(), screen, afterScreen: window.screenSnapshot(), caught };
    }, { expression });
    assert.deepEqual(result.after, result.before);
    assert.deepEqual(result.afterScreen, result.screen);
    assert.equal(result.caught?.isError, true);
    assert.equal(result.caught.code, code);
    assert.ok(result.caught.message.length > 0);
  });
}

test("invalid start in not-started/won/lost also preserves all state and UI", async () => {
  for (const status of ["not-started", "won", "lost"]) {
    if (status !== "not-started") await start();
    if (status === "won") await guess(reds);
    if (status === "lost") for (let i = 0; i < 10; i++) await guess(blues);
    assert.equal(await page.evaluate(() => window.codeSecretTest.getState().status), status);
    assert.equal(await page.evaluate(async () => {
      const before = JSON.stringify(window.codeSecretTest.getState());
      const screen = JSON.stringify(window.screenSnapshot());
      try { await window.codeSecretTest.startGame({ secret: null }); return false; }
      catch (error) {
        return error.code === "invalid-type" && before === JSON.stringify(window.codeSecretTest.getState())
          && screen === JSON.stringify(window.screenSnapshot());
      }
    }), true);
  }
});

test("unexpected exceptions reject API promises instead of becoming validation refusals", async () => {
  await start();
  const result = await page.evaluate(async () => {
    const api = window.codeSecretTest;
    const before = api.getState(), screen = window.screenSnapshot();
    const failure = new Error("Unexpected test getter failure");
    const outcomes = [];
    for (const [method, input] of [
      ["startGame", { get secret() { throw failure; } }],
      ["submitGuess", new Proxy([], { get() { throw failure; } })],
    ]) {
      try { await api[method](input); outcomes.push(false); }
      catch (error) { outcomes.push(error === failure); }
    }
    return { outcomes, before, after: api.getState(), screen, afterScreen: window.screenSnapshot() };
  });
  assert.deepEqual(result.outcomes, [true, true]);
  assert.deepEqual(result.before, result.after);
  assert.deepEqual(result.screen, result.afterScreen);
});

test("ninth-attempt refusal consumes nothing; victory at ten; finished priority; restart", async () => {
  await start();
  for (let i = 0; i < 9; i++) await guess(blues);
  const refused = await guess([R]);
  assert.equal(refused.attempts, 9);
  assert.equal(refused.lastError.code, "invalid-length");
  const won = await guess(reds);
  assert.equal(won.status, "won");
  assert.equal(won.attempts, 10);
  assert.equal(won.lastError, null);
  for (const proposal of [null, blues]) {
    const after = await guess(proposal);
    assert.equal(after.lastError.code, "game-finished");
    assert.deepEqual({ ...after, lastError: null }, won);
  }
  assert.deepEqual(await start(), fresh());
});

test("ten misses lose with 0/0; further guesses refused; restart clears all fields", async () => {
  await start();
  let lost;
  for (let i = 0; i < 10; i++) lost = await guess(blues);
  assert.equal(lost.status, "lost");
  assert.equal(lost.attempts, 10);
  assert.deepEqual(lost.lastResult, { wellPlaced: 0, misplaced: 0 });
  for (const proposal of [null, reds]) {
    const after = await guess(proposal);
    assert.equal(after.lastError.code, "game-finished");
    assert.deepEqual({ ...after, lastError: null }, lost);
  }
  assert.deepEqual(await start(), fresh());
});

test("random starts: omitted/undefined/{} discard imposed secret; six colours and repetitions", async () => {
  const results = await page.evaluate(async () => {
    const api = window.codeSecretTest;
    const original = Math.random;
    const states = [];
    try {
      for (let index = 0; index < 6; index++) {
        await window.callAPI("startGame", { secret: ["rouge", "rouge", "rouge", "rouge"] });
        Math.random = () => (index + 0.1) / 6;
        const args = index % 3 === 0 ? [] : index % 3 === 1 ? [undefined] : [{}];
        const initial = await window.callAPI("startGame", ...args);
        const state = await window.callAPI("submitGuess", Array(4).fill(api.getConfig().colors[index]));
        states.push({ initial, state });
      }
    } finally { Math.random = original; }
    return states;
  });
  for (const { initial, state } of results) {
    assert.deepEqual(initial, fresh());
    assert.equal(state.status, "won");
  }
});

test("input/config/state/result defensive copies, pure getters and no exposed secret", async () => {
  const result = await page.evaluate(async () => {
    const api = window.codeSecretTest;
    const secret = ["rouge", "rouge", "bleu", "vert"];
    const pendingStart = api.startGame({ secret });
    secret.fill("violet");
    const started = window.checkUI(await pendingStart);
    started.history.push({}); started.status = "lost";
    const proposal = ["rouge", "bleu", "rouge", "vert"];
    const pendingGuess = api.submitGuess(proposal);
    proposal.fill("jaune");
    const returned = window.checkUI(await pendingGuess);
    const before = api.getState();
    returned.history[0].guess.fill("orange"); returned.history[0].result.wellPlaced = 99;
    returned.lastGuess.fill("orange"); returned.lastResult.misplaced = 99;
    const read = api.getState();
    read.history[0].guess.fill("violet"); read.history[0].result.misplaced = 99;
    read.lastGuess.fill("violet"); read.lastResult.wellPlaced = 99; read.attempts = 99;
    const config = api.getConfig(); config.colors.fill("purple"); config.maxAttempts = 99;
    const after = window.checkUI(api.getState());
    const refused = await window.callAPI("submitGuess", null);
    refused.lastError.code = "changed";
    const readError = api.getState(); readError.lastError.message = "changed";
    const screen = window.screenSnapshot(), errorState = api.getState();
    api.getState(); api.getConfig();
    return { before, after, config: api.getConfig(), errorState,
      pure: JSON.stringify(screen) === JSON.stringify(window.screenSnapshot()),
      cleared: await window.callAPI("submitGuess", ["rouge", "rouge", "bleu", "vert"]) };
  });
  assert.deepEqual(result.after, result.before);
  assert.deepEqual(result.before.lastResult, { wellPlaced: 2, misplaced: 2 });
  assert.deepEqual(result.config.colors, [R, B, V, J, O, Vi]);
  assert.equal(result.config.maxAttempts, 10);
  assert.equal(result.errorState.lastError.code, "invalid-type");
  assert.notEqual(result.errorState.lastError.message, "changed");
  assert.equal(result.pure, true);
  assert.equal(result.cleared.lastError, null);
  assert.equal(result.cleared.status, "won");
});

test("API and real UI actions share the same game; keyboard, invalid form, restart reset", async () => {
  await start();
  await page.getByRole("button", { name: "Valider la proposition" }).click();
  await page.waitForFunction(() => window.codeSecretTest.getState().lastError !== null && !document.querySelector("#guess-fields").disabled);
  assert.match(await page.locator("#message").textContent(), /incomplète.*Aucun essai consommé/);
  assert.equal(await page.evaluate(() => window.codeSecretTest.getState().attempts), 0);
  assert.equal(await page.locator("select[aria-invalid='true']").count(), 4);
  // First selector is focused after refusal. Choose rouge, then Tab to next.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.codeSecretTest.getState().status === "won" && !document.querySelector("#new-game").disabled);
  const won = await page.evaluate(() => window.checkUI(window.codeSecretTest.getState()));
  assert.equal(won.attempts, 1);
  assert.deepEqual(won.lastGuess, reds);
  await page.getByRole("button", { name: "Nouvelle partie" }).click();
  await page.waitForFunction(() => window.codeSecretTest.getState().status === "playing" && !document.querySelector("#guess-fields").disabled);
  assert.deepEqual(await page.evaluate(() => window.checkUI(window.codeSecretTest.getState())), fresh());
  assert.deepEqual(await page.locator("select").evaluateAll((selects) => selects.map((select) => select.value)), ["", "", "", ""]);
  assert.equal(await page.locator("select[aria-invalid='true']").count(), 0);
  await page.locator("select").first().selectOption(Vi);
  await guess(blues);
  assert.deepEqual(await start(), fresh()); // API reset must also clear UI history/selections.
  assert.deepEqual(await page.locator("select").evaluateAll((selects) => selects.map((select) => select.value)), ["", "", "", ""]);
  assert.deepEqual(await page.locator("#positions .swatch").evaluateAll((dots) => dots.map((dot) => dot.dataset.color)), ["", "", "", ""]);
});

test("reload starts test mode fresh and keeps no imposed secret", async () => {
  await start();
  await guess(reds);
  await page.reload();
  await page.waitForFunction(() => window.codeSecretTest !== undefined);
  assert.deepEqual(await page.evaluate(() => window.checkUI(window.codeSecretTest.getState())), fresh("not-started"));
});

test("responsive layouts and emulated touch remain usable with API-driven history", async () => {
  await start([R, R, B, V]);
  await guess(blues);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}px`);
    for (const select of await page.locator("select").all()) {
      assert.ok((await select.boundingBox()).height >= 44, "select touch target height");
    }
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await mobile.goto(`${url}?test=1`);
    await mobile.waitForFunction(() => window.codeSecretTest !== undefined);
    await mobile.getByRole("button", { name: "Nouvelle partie" }).tap();
    await mobile.getByRole("button", { name: "Valider la proposition" }).tap();
    assert.match(await mobile.locator("#message").textContent(), /incomplète/);
    assert.equal(await mobile.evaluate(() => window.codeSecretTest.getState().attempts), 0);
  } finally { await mobile.close(); }
});

for (const query of ["", "?test=0", "?test", "?test=01", "?other=test%3D1", "?Test=1"]) {
  test(`API absent and normal game playable with ${query || "no query"}`, async () => {
    await page.goto(`${url}${query}`);
    await page.waitForFunction(() => !document.querySelector("#guess-fields").disabled);
    assert.equal(await page.evaluate(() => "codeSecretTest" in window), false);
    assert.equal(await page.locator("select").count(), 4);
    await page.getByRole("button", { name: "Nouvelle partie" }).click();
    await page.getByRole("button", { name: "Valider la proposition" }).click();
    assert.match(await page.locator("#message").textContent(), /incomplète/);
  });
}
test("test=1 works alongside other query parameters and duplicate keys", async () => {
  for (const query of ["?lang=fr&test=1&other=yes", "?test=0&test=1"]) {
    await page.goto(`${url}${query}`);
    await page.waitForFunction(() => window.codeSecretTest !== undefined);
    assert.deepEqual(await page.evaluate(() => window.checkUI(window.codeSecretTest.getState())), fresh("not-started"));
  }
});

test("normal mode still supports a complete mouse-driven game and restart without exposing API", async () => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector("#guess-fields").disabled);
  for (const select of await page.locator("select").all()) await select.selectOption(R);
  await page.getByRole("button", { name: "Valider la proposition" }).click();
  assert.match(await page.locator("#message").textContent(), /Bravo.*1 essai/);
  assert.equal(await page.locator("#history > li").count(), 1);
  assert.equal(await page.locator("select").first().isDisabled(), true);
  await page.getByRole("button", { name: "Nouvelle partie" }).click();
  assert.equal(await page.locator("#history > li").count(), 0);
  assert.equal(await page.locator("select").first().isDisabled(), false);
  assert.equal(await page.evaluate(() => "codeSecretTest" in window), false);
});
