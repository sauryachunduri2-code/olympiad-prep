type Q = {
  n: number;
  stem: string;
  choices: string[] | null;
  figure: string | null;
  fullFigure: boolean;
  answer: number;
  also: number[];
  topic: string;
  solution: string;
};
type Data = {
  id: string;
  title: string;
  limitSeconds: number;
  solutionsUrl: string;
  constants: string;
  questions: Q[];
};
type Attempt = {
  startedAt: number;
  answers: (number | null)[];
  flagged: number[];
  submittedAt?: number;
};
type Done = { id: string; at: number; score: number; total: number; seconds: number };

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const data: Data = JSON.parse(document.getElementById('paper-data')!.textContent!);
const root = document.querySelector<HTMLElement>('[data-paper]')!;
const ATTEMPT_KEY = `olympiad:attempt:${data.id}`;
const HISTORY_KEY = 'olympiad:history';
const total = data.questions.length;

const store = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: the paper still works, it just will not resume */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  },
};

const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
const qbody = $('#qbody');
const sheet = $('#sheet');
const clock = $('[data-clock]');
const timer = $('.timer');

let attempt: Attempt | null = null;
let current = 0;
let tick: number | undefined;

const deadline = () => attempt!.startedAt + data.limitSeconds * 1000;
const secondsLeft = () => Math.max(0, Math.ceil((deadline() - Date.now()) / 1000));
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const isRight = (q: Q, picked: number | null) => picked !== null && (picked === q.answer || q.also.includes(picked));
const save = () => store.set(ATTEMPT_KEY, attempt);
const setState = (s: 'intro' | 'test' | 'results') => {
  root.dataset.state = s;
  window.scrollTo({ top: 0 });
};

/* Answer sheet */
function buildSheet() {
  sheet.innerHTML = data.questions
    .map(
      (q, i) => `<div class="row" data-row="${i}">
        <button class="num" type="button" data-jump="${i}" aria-label="Go to question ${q.n}">${q.n}</button>
        ${LETTERS.map(
          (l, c) =>
            `<button class="bubble" type="button" data-q="${i}" data-c="${c}" aria-pressed="false" aria-label="Question ${q.n}, choice ${l}">${l}</button>`,
        ).join('')}
      </div>`,
    )
    .join('');
}

function paint() {
  if (!attempt) return;
  attempt.answers.forEach((picked, i) => {
    const row = sheet.querySelector<HTMLElement>(`[data-row="${i}"]`)!;
    row.classList.toggle('current', i === current);
    row.classList.toggle('flagged', attempt!.flagged.includes(i));
    row.querySelectorAll<HTMLButtonElement>('.bubble').forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.c) === picked)),
    );
  });
  qbody.querySelectorAll<HTMLButtonElement>('.bubble').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.c) === attempt!.answers[current])),
  );
  const answered = attempt.answers.filter((a) => a !== null).length;
  $('[data-count]').textContent = `${answered} of ${total} answered` + (attempt.flagged.length ? `, ${attempt.flagged.length} flagged` : '');
  const flag = $<HTMLButtonElement>('[data-flag]');
  flag.setAttribute('aria-pressed', String(attempt.flagged.includes(current)));
  flag.textContent = attempt.flagged.includes(current) ? 'Remove flag' : 'Flag for review';
  $<HTMLButtonElement>('[data-prev]').disabled = current === 0;
  $<HTMLButtonElement>('[data-next]').disabled = current === total - 1;
}

function renderQuestion() {
  const q = data.questions[current];
  const figure = q.figure ? `<img src="${q.figure}" alt="Figure for question ${q.n}" />` : '';
  let body: string;
  if (q.fullFigure) {
    body = `${figure}<p class="figure-note">The answer choices are in the figure. Mark your answer on the sheet or with the keys below it.</p>`;
  } else {
    const choices = q
      .choices!.map(
        (c, i) =>
          `<li><button class="bubble" type="button" data-c="${i}" aria-pressed="false" aria-label="Choice ${LETTERS[i]}">${LETTERS[i]}</button><span>${c}</span></li>`,
      )
      .join('');
    body = `${q.stem}${figure}<ol class="choices">${choices}</ol>`;
  }
  qbody.innerHTML = `<h2 class="qhead">Question ${q.n} <span>of ${total}</span></h2>${body}`;
  paint();
}

function go(i: number) {
  current = Math.min(total - 1, Math.max(0, i));
  renderQuestion();
}

function choose(c: number, q = current) {
  if (!attempt) return;
  attempt.answers[q] = attempt.answers[q] === c ? null : c;
  save();
  paint();
}

/* Timer and submission */
function updateClock() {
  const left = secondsLeft();
  clock.textContent = mmss(left);
  timer.dataset.low = String(left <= 300);
  if (left === 0) finish();
}

function startTicking() {
  updateClock();
  window.clearInterval(tick);
  tick = window.setInterval(updateClock, 1000);
}

function finish() {
  if (!attempt || attempt.submittedAt) return;
  window.clearInterval(tick);
  attempt.submittedAt = Math.min(Date.now(), deadline());
  save();
  const done: Done[] = store.get<Done[]>(HISTORY_KEY) ?? [];
  done.push({
    id: data.id,
    at: attempt.submittedAt,
    score: attempt.answers.filter((a, i) => isRight(data.questions[i], a)).length,
    total,
    seconds: Math.round((attempt.submittedAt - attempt.startedAt) / 1000),
  });
  store.set(HISTORY_KEY, done);
  showResults();
}

function askToSubmit() {
  const blank = attempt!.answers.filter((a) => a === null).length;
  const flagged = attempt!.flagged.length;
  $('[data-confirm-text]').textContent =
    `${blank === 0 ? 'Every question has an answer.' : `${blank} ${blank === 1 ? 'question is' : 'questions are'} blank.`}` +
    `${flagged ? ` ${flagged} ${flagged === 1 ? 'is' : 'are'} flagged for review.` : ''}` +
    ` You have ${mmss(secondsLeft())} left. You cannot change answers after submitting.`;
  const box = $('.confirm');
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
  $<HTMLButtonElement>('[data-confirm-no]').focus();
}

/* Results */
function showResults() {
  const a = attempt!;
  const graded = data.questions.map((q, i) => ({ q, picked: a.answers[i], ok: isRight(q, a.answers[i]) }));
  const score = graded.filter((g) => g.ok).length;
  const used = Math.round(((a.submittedAt ?? Date.now()) - a.startedAt) / 1000);
  const timedOut = used >= data.limitSeconds;

  const byTopic = new Map<string, { ok: number; all: number }>();
  graded.forEach(({ q, ok }) => {
    const t = byTopic.get(q.topic) ?? { ok: 0, all: 0 };
    t.all += 1;
    if (ok) t.ok += 1;
    byTopic.set(q.topic, t);
  });
  const topicRows = [...byTopic.entries()]
    .sort((x, y) => x[1].ok / x[1].all - y[1].ok / y[1].all || y[1].all - x[1].all)
    .map(([name, t]) => `<tr><th scope="row">${name}</th><td class="${t.ok / t.all < 0.5 ? 'weak' : ''}">${t.ok} of ${t.all}</td></tr>`)
    .join('');

  const rows = graded
    .map(({ q, picked, ok }) => {
      const marks = LETTERS.map((l, c) => {
        const cls = [c === q.answer || q.also.includes(c) ? 'is-key' : '', picked === c && !ok ? 'is-miss' : ''].join(' ');
        return `<span class="bubble ${cls}" aria-hidden="true" ${picked === c ? 'aria-pressed="true"' : ''}>${l}</span>`;
      }).join('');
      const verdict =
        picked === null ? 'Left blank' : ok ? 'Correct' : `You chose ${LETTERS[picked]}`;
      const key = q.also.length
        ? `${LETTERS[q.answer]} (${q.also.map((c) => LETTERS[c]).join(', ')} also accepted)`
        : LETTERS[q.answer];
      return `<details>
        <summary><span class="qnum">${q.n}</span><span class="marks">${marks}</span><span class="verdict" data-ok="${picked === null ? '' : ok}">${verdict}. Answer: ${key}</span></summary>
        <div class="detail">${q.figure ? `<img src="${q.figure}" alt="Figure for question ${q.n}" />` : ''}${q.solution}<p><a href="${data.solutionsUrl}">Official solution for question ${q.n}</a></p></div>
      </details>`;
    })
    .join('');

  $('#results').innerHTML = `
    <p class="score">${score}<small> of ${total}</small></p>
    <p class="score-note">${timedOut ? 'Time ran out.' : `Finished in ${used < 60 ? `${used} seconds` : `${Math.floor(used / 60)} min ${used % 60} sec`}.`} Each question was worth one point.</p>
    <div class="results-grid">
      <div>
        <h2>Where the points went</h2>
        <table class="topics"><thead><tr><th scope="col">Topic</th><th scope="col">Correct</th></tr></thead><tbody>${topicRows}</tbody></table>
      </div>
      <div>
        <h2>Question by question</h2>
        <div class="review">${rows}</div>
      </div>
    </div>
    <div class="result-actions">
      <button class="btn" type="button" data-again>Sit this paper again</button>
      <a class="btn quiet" href="/hub/">Back to the Hub</a>
    </div>`;
  setState('results');
}

/* Intro */
function showHistory() {
  const mine = (store.get<Done[]>(HISTORY_KEY) ?? []).filter((d) => d.id === data.id).reverse();
  const box = $('.history');
  box.hidden = mine.length === 0;
  $('.history ul').innerHTML = mine
    .map(
      (d) =>
        `<li><span>${new Date(d.at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}, ${Math.round(d.seconds / 60)} minutes</span><span>${d.score} of ${d.total}</span></li>`,
    )
    .join('');
}

function start() {
  attempt = { startedAt: Date.now(), answers: Array(total).fill(null), flagged: [] };
  save();
  openTest();
}

function openTest() {
  buildSheet();
  go(0);
  setState('test');
  startTicking();
}

/* Wiring */
root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!t) return;
  if (t.matches('[data-start]')) start();
  else if (t.matches('[data-prev]')) go(current - 1);
  else if (t.matches('[data-next]')) go(current + 1);
  else if (t.matches('[data-flag]')) {
    const at = attempt!.flagged.indexOf(current);
    if (at >= 0) attempt!.flagged.splice(at, 1);
    else attempt!.flagged.push(current);
    save();
    paint();
  } else if (t.matches('[data-submit]')) askToSubmit();
  else if (t.matches('[data-confirm-no]')) $('.confirm').hidden = true;
  else if (t.matches('[data-confirm-yes]')) {
    $('.confirm').hidden = true;
    finish();
  } else if (t.matches('[data-again]')) {
    store.del(ATTEMPT_KEY);
    attempt = null;
    showHistory();
    setState('intro');
  } else if (t.dataset.jump) go(Number(t.dataset.jump));
  else if (t.classList.contains('bubble') && t.dataset.c !== undefined) {
    const q = t.dataset.q !== undefined ? Number(t.dataset.q) : current;
    if (q !== current) go(q);
    choose(Number(t.dataset.c), q);
  }
});

document.addEventListener('keydown', (e) => {
  if (root.dataset.state !== 'test' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('.confirm').hidden) return;
  const key = e.key.toLowerCase();
  const letter = LETTERS.map((l) => l.toLowerCase()).indexOf(key);
  if (letter >= 0) choose(letter);
  else if (key === 'arrowright') go(current + 1);
  else if (key === 'arrowleft') go(current - 1);
  else if (key === 'f') $<HTMLButtonElement>('[data-flag]').click();
  else return;
  e.preventDefault();
});

attempt = store.get<Attempt>(ATTEMPT_KEY);
if (attempt && attempt.answers.length === total) {
  if (attempt.submittedAt) showResults();
  else openTest(); // an expired clock submits on the first tick
} else {
  attempt = null;
  showHistory();
}
