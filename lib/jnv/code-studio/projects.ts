import type { CodeStudioProject } from "@/lib/jnv/code-studio/types";

/**
 * Starter project catalog — client-safe, no server dependency. Every project
 * ships a small but genuinely working skeleton (not a blank file) so the
 * live preview / console shows something real the moment it opens, with
 * clear TODOs for the student to extend. Kept intentionally short: this is a
 * starting point for a lesson, not a finished app.
 */
export const CODE_STUDIO_PROJECTS: CodeStudioProject[] = [
  // ---------------------------------------------------------------- HTML
  {
    id: "html-portfolio",
    language: "html",
    title: "Personal Portfolio",
    description: "An about-me page with sections for skills and projects.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My Portfolio</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1>Your Name</h1>
    <p>Class 9 &middot; JNV Student &middot; Future Developer</p>
  </header>

  <section id="about">
    <h2>About Me</h2>
    <p>TODO: Write 2-3 lines about yourself.</p>
  </section>

  <section id="skills">
    <h2>Skills</h2>
    <ul>
      <li>HTML &amp; CSS</li>
      <li>JavaScript</li>
      <li>TODO: add your own skill</li>
    </ul>
  </section>

  <section id="projects">
    <h2>My Projects</h2>
    <div class="card">
      <h3>Project 1</h3>
      <p>TODO: describe a project you built.</p>
    </div>
  </section>

  <footer>
    <p>&copy; <span id="year"></span> Your Name</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>
`,
      css: `body {
  font-family: system-ui, sans-serif;
  margin: 0;
  color: #1e293b;
  background: #f8fafc;
}

header {
  padding: 3rem 1.5rem;
  text-align: center;
  background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
  color: white;
}

section {
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  background: white;
}

footer {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-size: 0.85rem;
}
`,
      js: `// TODO: try adding more sections and updating them from here.
document.getElementById("year").textContent = new Date().getFullYear();
`,
    },
  },
  {
    id: "html-resume",
    language: "html",
    title: "Resume",
    description: "A clean, printable resume layout.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Resume</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="resume">
    <h1>Your Name</h1>
    <p class="contact">your.email@example.com &middot; Your City</p>

    <h2>Education</h2>
    <p><strong>Jawahar Navodaya Vidyalaya</strong> &mdash; Class 6-10</p>

    <h2>Skills</h2>
    <ul>
      <li>Problem solving</li>
      <li>HTML / CSS / JavaScript basics</li>
      <li>TODO: add a skill</li>
    </ul>

    <h2>Achievements</h2>
    <ul>
      <li>TODO: add an achievement</li>
    </ul>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: Georgia, serif; background: #f1f5f9; margin: 0; }
.resume {
  max-width: 640px;
  margin: 2rem auto;
  background: white;
  padding: 2.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
h1 { margin-bottom: 0.25rem; }
.contact { color: #64748b; margin-top: 0; }
h2 { border-bottom: 2px solid #1d4ed8; padding-bottom: 0.25rem; margin-top: 1.75rem; }
`,
      js: `// TODO: add a "Print Resume" button that calls window.print().
`,
    },
  },
  {
    id: "html-school-website",
    language: "html",
    title: "School Website",
    description: "A simple multi-section homepage for a school.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My School</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <nav>
    <strong>JNV</strong>
    <a href="#about">About</a>
    <a href="#notices">Notices</a>
    <a href="#contact">Contact</a>
  </nav>

  <header>
    <h1>Welcome to Our School</h1>
    <p>Excellence in learning since TODO year.</p>
  </header>

  <section id="about">
    <h2>About Us</h2>
    <p>TODO: describe the school in 2-3 sentences.</p>
  </section>

  <section id="notices">
    <h2>Notices</h2>
    <ul id="notice-list"></ul>
  </section>

  <section id="contact">
    <h2>Contact</h2>
    <p>TODO: add an address / phone number.</p>
  </section>

  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: system-ui, sans-serif; margin: 0; color: #1e293b; }
nav { display: flex; gap: 1.25rem; align-items: center; padding: 1rem 1.5rem; background: #0f172a; color: white; }
nav a { color: #cbd5e1; text-decoration: none; }
header { padding: 3rem 1.5rem; text-align: center; background: #e0f2fe; }
section { max-width: 700px; margin: 2rem auto; padding: 0 1.5rem; }
`,
      js: `// Renders a couple of sample notices — replace with your own.
const notices = ["Sports Day on Friday", "PTM next Monday", "TODO: add a real notice"];
const list = document.getElementById("notice-list");
for (const n of notices) {
  const li = document.createElement("li");
  li.textContent = n;
  list.appendChild(li);
}
`,
    },
  },

  // ----------------------------------------------------------------- CSS
  {
    id: "css-cards",
    language: "css",
    title: "Cards",
    description: "A responsive grid of profile/product cards.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Cards</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="grid">
    <div class="card">
      <div class="thumb"></div>
      <h3>Card One</h3>
      <p>A short description goes here.</p>
    </div>
    <div class="card">
      <div class="thumb"></div>
      <h3>Card Two</h3>
      <p>A short description goes here.</p>
    </div>
    <div class="card">
      <div class="thumb"></div>
      <h3>Card Three</h3>
      <p>A short description goes here.</p>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 2rem; }
.grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  max-width: 900px;
  margin: 0 auto;
}
.card {
  background: white;
  border-radius: 14px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.12);
}
.thumb {
  height: 120px;
  border-radius: 10px;
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, #1d4ed8, #38bdf8);
}
/* TODO: try changing the gradient, or add a badge in the corner of each card. */
`,
      js: `// Optional: highlight a card on click.
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("click", () => card.classList.toggle("selected"));
});
`,
    },
  },
  {
    id: "css-responsive-layout",
    language: "css",
    title: "Responsive Layout",
    description: "A page layout that reflows from mobile to desktop.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Responsive Layout</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="layout">
    <header class="header">Header</header>
    <nav class="sidebar">Sidebar</nav>
    <main class="content">
      <h1>Resize the preview panel!</h1>
      <p>This layout stacks on narrow screens and sits side-by-side on wide ones.</p>
    </main>
    <footer class="footer">Footer</footer>
  </div>
</body>
</html>
`,
      css: `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-areas: "header" "sidebar" "content" "footer";
  grid-template-rows: auto auto 1fr auto;
}
.header  { grid-area: header;  background: #1d4ed8; color: white; padding: 1rem; }
.sidebar { grid-area: sidebar; background: #e2e8f0; padding: 1rem; }
.content { grid-area: content; padding: 1rem; }
.footer  { grid-area: footer;  background: #0f172a; color: white; padding: 1rem; text-align: center; }

/* TODO: this is the breakpoint — try changing 700px and see the layout react live. */
@media (min-width: 700px) {
  .layout {
    grid-template-areas: "header header" "sidebar content" "footer footer";
    grid-template-columns: 220px 1fr;
  }
}
`,
      js: "",
    },
  },
  {
    id: "css-animations",
    language: "css",
    title: "Animations",
    description: "Keyframe animations and hover transitions.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Animations</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="stage">
    <div class="box bounce">Bounce</div>
    <div class="box spin">Spin</div>
    <div class="box pulse">Pulse</div>
  </div>
</body>
</html>
`,
      css: `body { min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; background: #0f172a; }
.stage { display: flex; gap: 2rem; }
.box {
  width: 100px; height: 100px;
  display: grid; place-items: center;
  border-radius: 16px;
  color: white; font-family: system-ui, sans-serif; font-size: 0.85rem;
  background: linear-gradient(135deg, #1d4ed8, #38bdf8);
}
.bounce { animation: bounce 1.2s infinite ease-in-out; }
.spin   { animation: spin 3s linear infinite; }
.pulse  { animation: pulse 1.5s ease-in-out infinite; }

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-24px); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
}
/* TODO: add your own @keyframes animation and a 4th box that uses it. */
`,
      js: "",
    },
  },

  // ---------------------------------------------------------- JavaScript
  {
    id: "js-calculator",
    language: "javascript",
    title: "Calculator",
    description: "A working button-based calculator.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Calculator</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="calc">
    <input id="display" readonly value="0" />
    <div class="keys">
      <button data-key="7">7</button><button data-key="8">8</button><button data-key="9">9</button><button data-key="/">÷</button>
      <button data-key="4">4</button><button data-key="5">5</button><button data-key="6">6</button><button data-key="*">×</button>
      <button data-key="1">1</button><button data-key="2">2</button><button data-key="3">3</button><button data-key="-">−</button>
      <button data-key="0">0</button><button data-key=".">.</button><button data-key="=" class="eq">=</button><button data-key="+">+</button>
      <button data-key="clear" class="clear">C</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { display: grid; place-items: center; min-height: 100vh; margin: 0; background: #0f172a; font-family: system-ui, sans-serif; }
.calc { background: #1e293b; padding: 1rem; border-radius: 16px; width: 260px; }
#display { width: 100%; box-sizing: border-box; margin-bottom: 0.75rem; padding: 0.75rem; font-size: 1.5rem; text-align: right; border-radius: 10px; border: none; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
button { padding: 0.9rem 0; border: none; border-radius: 10px; background: #334155; color: white; font-size: 1rem; cursor: pointer; }
button:active { background: #475569; }
.eq { background: #1d4ed8; grid-row: span 2; }
.clear { grid-column: span 4; background: #b91c1c; }
`,
      js: `const display = document.getElementById("display");
let expr = "";

document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.key;
    if (key === "clear") {
      expr = "";
    } else if (key === "=") {
      try {
        // TODO: this uses eval for simplicity — as a challenge, try writing
        // your own tiny parser instead of relying on eval.
        expr = String(eval(expr));
      } catch {
        expr = "Error";
      }
    } else {
      expr += key;
    }
    display.value = expr || "0";
  });
});
`,
    },
  },
  {
    id: "js-todo",
    language: "javascript",
    title: "Todo App",
    description: "Add, complete and remove tasks.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Todo App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <h1>My Tasks</h1>
    <form id="form">
      <input id="input" placeholder="Add a task..." autocomplete="off" />
      <button type="submit">Add</button>
    </form>
    <ul id="list"></ul>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: system-ui, sans-serif; background: #f8fafc; display: grid; place-items: start center; min-height: 100vh; margin: 0; padding-top: 2rem; }
.app { width: 320px; }
form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
input { flex: 1; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; }
button { padding: 0.6rem 0.9rem; border: none; border-radius: 8px; background: #1d4ed8; color: white; cursor: pointer; }
#list { list-style: none; padding: 0; }
#list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; }
#list li.done span { text-decoration: line-through; color: #94a3b8; }
#list li span { flex: 1; }
#list li button { background: #ef4444; }
`,
      js: `const form = document.getElementById("form");
const input = document.getElementById("input");
const list = document.getElementById("list");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addTask(text);
  input.value = "";
});

function addTask(text) {
  const li = document.createElement("li");
  const span = document.createElement("span");
  span.textContent = text;
  span.addEventListener("click", () => li.classList.toggle("done"));

  const del = document.createElement("button");
  del.textContent = "✕";
  del.addEventListener("click", () => li.remove());

  li.append(span, del);
  list.appendChild(li);
}

// TODO: as a challenge, save the task list to localStorage so it survives a refresh.
`,
    },
  },
  {
    id: "js-quiz",
    language: "javascript",
    title: "Quiz App",
    description: "A multiple-choice quiz with a running score.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quiz App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="quiz">
    <p id="progress"></p>
    <h2 id="question"></h2>
    <div id="options"></div>
    <p id="score"></p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: system-ui, sans-serif; background: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }
.quiz { width: 320px; text-align: center; }
#options button { display: block; width: 100%; margin: 0.4rem 0; padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; background: white; cursor: pointer; }
#options button.correct { background: #bbf7d0; border-color: #22c55e; }
#options button.wrong { background: #fecaca; border-color: #ef4444; }
#progress { color: #64748b; font-size: 0.85rem; }
`,
      js: `const questions = [
  { q: "What does HTML stand for?", options: ["Hyper Trainer Markup Language", "HyperText Markup Language", "Hyper Text Marketing Language"], answer: 1 },
  { q: "Which tag creates a hyperlink?", options: ["<link>", "<a>", "<href>"], answer: 1 },
  { q: "Which symbol starts a CSS comment?", options: ["//", "#", "/*"], answer: 2 },
  // TODO: add more questions here.
];

let index = 0;
let score = 0;

const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");

function render() {
  const current = questions[index];
  progressEl.textContent = \`Question \${index + 1} of \${questions.length}\`;
  questionEl.textContent = current.q;
  scoreEl.textContent = \`Score: \${score}\`;
  optionsEl.innerHTML = "";
  current.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.addEventListener("click", () => choose(i, btn));
    optionsEl.appendChild(btn);
  });
}

function choose(i, btn) {
  const current = questions[index];
  const buttons = [...optionsEl.children];
  buttons.forEach((b) => (b.disabled = true));
  if (i === current.answer) {
    btn.classList.add("correct");
    score++;
  } else {
    btn.classList.add("wrong");
    buttons[current.answer].classList.add("correct");
  }
  setTimeout(() => {
    index = (index + 1) % questions.length;
    render();
  }, 800);
}

render();
`,
    },
  },
  {
    id: "js-stopwatch",
    language: "javascript",
    title: "Stopwatch",
    description: "Start, pause, reset and lap timing.",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Stopwatch</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <div id="time">00:00.0</div>
    <div class="buttons">
      <button id="start">Start</button>
      <button id="pause">Pause</button>
      <button id="reset">Reset</button>
    </div>
    <ul id="laps"></ul>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: grid; place-items: center; min-height: 100vh; margin: 0; }
.app { text-align: center; width: 240px; }
#time { font-size: 2.5rem; font-variant-numeric: tabular-nums; margin-bottom: 1rem; }
.buttons { display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1rem; }
button { padding: 0.5rem 0.9rem; border: none; border-radius: 8px; background: #1d4ed8; color: white; cursor: pointer; }
#laps { list-style: none; padding: 0; text-align: left; color: #94a3b8; font-size: 0.85rem; }
`,
      js: `const timeEl = document.getElementById("time");
const laps = document.getElementById("laps");
let elapsedMs = 0;
let intervalId = null;
let lastTick = 0;

function format(ms) {
  const min = String(Math.floor(ms / 60000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return \`\${min}:\${sec}.\${tenths}\`;
}

document.getElementById("start").addEventListener("click", () => {
  if (intervalId) return;
  lastTick = Date.now();
  intervalId = setInterval(() => {
    const now = Date.now();
    elapsedMs += now - lastTick;
    lastTick = now;
    timeEl.textContent = format(elapsedMs);
  }, 100);
});

document.getElementById("pause").addEventListener("click", () => {
  clearInterval(intervalId);
  intervalId = null;
  const li = document.createElement("li");
  li.textContent = \`Lap: \${format(elapsedMs)}\`;
  laps.prepend(li);
});

document.getElementById("reset").addEventListener("click", () => {
  clearInterval(intervalId);
  intervalId = null;
  elapsedMs = 0;
  timeEl.textContent = format(0);
  laps.innerHTML = "";
});

// TODO: disable the Start button while running, and Pause while stopped.
`,
    },
  },
  {
    id: "js-weather",
    language: "javascript",
    title: "Weather App",
    description: "A weather card driven by sample data (no API key needed).",
    files: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Weather App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="card">
    <select id="city"></select>
    <h1 id="temp"></h1>
    <p id="condition"></p>
    <p id="details"></p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      css: `body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg,#0ea5e9,#1d4ed8); }
.card { background: white; border-radius: 16px; padding: 1.75rem 2rem; text-align: center; width: 240px; }
#temp { font-size: 3rem; margin: 0.25rem 0; }
select { padding: 0.4rem; border-radius: 8px; }
#details { color: #64748b; font-size: 0.85rem; }
`,
      js: `// TODO: this uses fake sample data since the studio can't call a real
// weather API without a key. Try adding more cities, or (as a stretch goal)
// wiring this up to a real API using fetch() with your own API key.
const sampleWeather = {
  Delhi: { temp: 34, condition: "Sunny", humidity: 40 },
  Mumbai: { temp: 29, condition: "Humid", humidity: 78 },
  Shimla: { temp: 18, condition: "Cloudy", humidity: 60 },
};

const citySelect = document.getElementById("city");
Object.keys(sampleWeather).forEach((city) => {
  const opt = document.createElement("option");
  opt.value = city;
  opt.textContent = city;
  citySelect.appendChild(opt);
});

function render(city) {
  const data = sampleWeather[city];
  document.getElementById("temp").textContent = \`\${data.temp}°C\`;
  document.getElementById("condition").textContent = data.condition;
  document.getElementById("details").textContent = \`Humidity: \${data.humidity}%\`;
}

citySelect.addEventListener("change", (e) => render(e.target.value));
render(citySelect.value);
`,
    },
  },

  // -------------------------------------------------------------- Python
  {
    id: "py-calculator",
    language: "python",
    title: "Calculator",
    description: "A simple command-line style calculator.",
    files: {
      py: `# Simple calculator — edit the numbers/operation below and press Run.

def calculate(a, op, b):
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        return a / b if b != 0 else "Cannot divide by zero"
    return "Unknown operator"


a = 12
op = "+"
b = 8

print(f"{a} {op} {b} = {calculate(a, op, b)}")

# TODO: try changing a, op, b above, or add support for "%" (modulo).
`,
    },
  },
  {
    id: "py-number-guessing",
    language: "python",
    title: "Number Guessing Game",
    description: "Guess the secret number using hints.",
    files: {
      py: `import random

# Note: this studio's console only shows print() output — it doesn't accept
# typed input() while running, so this version plays itself with random
# guesses. As a challenge, try wiring guesses to button clicks instead.

secret = random.randint(1, 20)
attempts = 0
guess = random.randint(1, 20)

print("Guess the number between 1 and 20!")

while guess != secret and attempts < 10:
    attempts += 1
    if guess < secret:
        print(f"Guess {attempts}: {guess} -> Too low!")
    else:
        print(f"Guess {attempts}: {guess} -> Too high!")
    guess = random.randint(1, 20)

if guess == secret:
    print(f"Guessed {secret} correctly in {attempts + 1} tries!")
else:
    print(f"Out of attempts! The number was {secret}.")

# TODO: replace the random guesser with a smarter strategy (binary search!).
`,
    },
  },
  {
    id: "py-student-management",
    language: "python",
    title: "Student Management System",
    description: "Store students and print a class report.",
    files: {
      py: `students = [
    {"name": "Aarav", "roll": 1, "marks": 82},
    {"name": "Isha", "roll": 2, "marks": 91},
    {"name": "Rohan", "roll": 3, "marks": 67},
]


def add_student(name, roll, marks):
    students.append({"name": name, "roll": roll, "marks": marks})


def class_average():
    return sum(s["marks"] for s in students) / len(students)


def topper():
    return max(students, key=lambda s: s["marks"])


add_student("Priya", 4, 88)

print("Roll  Name       Marks")
for s in students:
    print(f'{s["roll"]:<5} {s["name"]:<10} {s["marks"]}')

print(f"\\nClass average: {class_average():.1f}")
print(f"Topper: {topper()['name']} with {topper()['marks']} marks")

# TODO: add a function that returns all students who scored below 40 (fail list).
`,
    },
  },
  {
    id: "py-banking-system",
    language: "python",
    title: "Banking System",
    description: "A tiny bank account class with deposit/withdraw.",
    files: {
      py: `class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance
        self.history = []

    def deposit(self, amount):
        self.balance += amount
        self.history.append(f"Deposited {amount}")

    def withdraw(self, amount):
        if amount > self.balance:
            self.history.append(f"Failed withdrawal of {amount} (insufficient funds)")
            return False
        self.balance -= amount
        self.history.append(f"Withdrew {amount}")
        return True


account = BankAccount("Aarav", balance=500)
account.deposit(200)
account.withdraw(150)
account.withdraw(10000)  # should fail

print(f"Owner: {account.owner}")
print(f"Balance: {account.balance}")
print("History:")
for line in account.history:
    print(f" - {line}")

# TODO: add a transfer(other_account, amount) method between two accounts.
`,
    },
  },
  {
    id: "py-mini-games",
    language: "python",
    title: "Mini Games — Rock, Paper, Scissors",
    description: "A simple rock-paper-scissors simulator.",
    files: {
      py: `import random

CHOICES = ["rock", "paper", "scissors"]
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}


def play_round(player, computer):
    if player == computer:
        return "draw"
    return "player" if BEATS[player] == computer else "computer"


player_score = 0
computer_score = 0

for round_number in range(1, 6):
    player_choice = random.choice(CHOICES)  # TODO: hook this up to real buttons
    computer_choice = random.choice(CHOICES)
    result = play_round(player_choice, computer_choice)

    if result == "player":
        player_score += 1
    elif result == "computer":
        computer_score += 1

    print(f"Round {round_number}: you={player_choice} vs computer={computer_choice} -> {result}")

print(f"\\nFinal score — You: {player_score}  Computer: {computer_score}")
if player_score > computer_score:
    print("You win overall!")
elif player_score < computer_score:
    print("Computer wins overall!")
else:
    print("It's a tie!")

# TODO: add a "best of" mode, or a second mini-game like a number-guessing round.
`,
    },
  },
];

export function getCodeStudioProject(id: string): CodeStudioProject | undefined {
  return CODE_STUDIO_PROJECTS.find((p) => p.id === id);
}

export function getCodeStudioProjectsForLanguage(language: string): CodeStudioProject[] {
  return CODE_STUDIO_PROJECTS.filter((p) => p.language === language);
}
