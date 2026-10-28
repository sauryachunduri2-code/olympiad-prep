import { loadPractice, record, setLastPractice, stateOf } from './progress';

type Q = {
  id: string;
  label: string;
  stem: string;
  choices: string[] | null;
  figure: string | null;
  fullFigure: boolean;
  answer: number;
  also: number[];
  solution: string;
};
type Data = { course: string; topic: { slug: string; name: string }; questions: Q[] };

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const data: Data = JSON.parse(document.getElementById('practice-data')!.textContent!);
const root = document.querySelector<HTMLElement>('[data-practice]')!;
const panel = root.querySelector<HTMLElement>('[data-qpanel]')!;
const dotsEl = root.querySelector<HTMLElement>('[data-dots]')!;
const summary = root.querySelector<HTMLElement>('[data-summary]')!;

const isRight = (q: Q, pick: number) => pick === q.answer || q.also.includes(pick);

// Start with what needs the most work: missed first, then unseen, then correct. Stable within each group.
function order(list: Q[]): Q[] {
  const progress = loadPractice();
  const rank = { missed: 0, unseen: 1, correct: 2 } as const;
  return list
    .map((q, i) => ({ q, i, r: rank[stateOf(progress, q.id)] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.q);
}

let queue = order(data.questions);
let idx = 0;
const picks = new Map<string, number>();

setLastPractice({ course: data.course, topic: data.topic.slug, name: data.topic.name });

function paintDots() {
  dotsEl.innerHTML = queue
    .map((q, i) => {
      const pick = picks.get(q.id);
      const s = pick === undefined ? 'unseen' : isRight(q, pick) ? 'correct' : 'missed';
      return `<button class="dot${i === idx ? ' here' : ''}" type="button" data-go="${i}" data-s="${s}" aria-label="Question ${i + 1} of ${queue.length}, ${s === 'unseen' ? 'not answered' : s}"></button>`;
    })
    .join('');
}

function render() {
  summary.hidden = true;
  panel.hidden = false;
  const q = queue[idx];
  const pick = picks.get(q.id);
  const answered = pick !== undefined;

  const figure = q.figure ? `<img src="${q.figure}" alt="Figure for this question" />` : '';
  let body: string;
  if (q.fullFigure) {
    const row = LETTERS.map((l, i) => bubble(q, i, pick, answered, l)).join('');
    body = `${figure}<p class="q-note">The answer choices are in the figure.</p><div class="letters">${row}</div>`;
  } else {
    const items = q
      .choices!.map((c, i) => `<li${answered ? ' data-locked' : ''}>${bubble(q, i, pick, answered, LETTERS[i])}<span>${c}</span></li>`)
      .join('');
    body = `${q.stem}${figure}<ol class="choices">${items}</ol>`;
  }

  let feedback = '';
  if (answered) {
    const ok = isRight(q, pick!);
    const key = q.also.length ? `${LETTERS[q.answer]} (${q.also.map((c) => LETTERS[c]).join(', ')} also accepted)` : LETTERS[q.answer];
    const last = idx === queue.length - 1;
    feedback = `<div class="feedback" data-ok="${ok}">
      <p class="verdict">${ok ? 'Correct.' : `Not this one. The answer is ${key}.`}</p>
      <div class="why">${q.solution}</div>
      <div class="next"><button class="btn" type="button" data-next>${last ? 'See your results' : 'Next question'}</button><span class="hint">Press Enter to continue</span></div>
    </div>`;
  }

  panel.innerHTML = `<p class="q-source">Question ${idx + 1} of ${queue.length}. From ${q.label}.</p><div class="q-body">${body}</div>${feedback}`;
  paintDots();
}

function bubble(q: Q, i: number, pick: number | undefined, answered: boolean, letter: string) {
  const classes = ['bubble'];
  if (answered) {
    if (i === q.answer || q.also.includes(i)) classes.push('is-key');
    if (pick === i && !isRight(q, i)) classes.push('is-miss');
  }
  return `<button class="${classes.join(' ')}" type="button" data-pick="${i}" aria-pressed="${pick === i}" ${answered ? 'disabled' : ''} aria-label="Choice ${letter}">${letter}</button>`;
}

function choose(i: number) {
  const q = queue[idx];
  if (picks.has(q.id)) return;
  picks.set(q.id, i);
  record(q.id, isRight(q, i));
  render();
  panel.querySelector('.feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function next() {
  if (idx < queue.length - 1) {
    idx += 1;
    render();
    window.scrollTo({ top: 0 });
  } else {
    showSummary();
  }
}

function showSummary() {
  const total = queue.length;
  const right = queue.filter((q) => picks.has(q.id) && isRight(q, picks.get(q.id)!)).length;
  const missed = queue.filter((q) => picks.has(q.id) && !isRight(q, picks.get(q.id)!));
  panel.hidden = true;
  summary.hidden = false;
  summary.innerHTML = `
    <h2>${data.topic.name}</h2>
    <p class="score">${right}<small> of ${total}</small></p>
    <p class="muted">${
      missed.length === 0
        ? 'You got every question in this set right.'
        : `${missed.length} to go back over. They will come first next time you practice this topic.`
    }</p>
    <div class="actions">
      ${missed.length ? `<button class="btn" type="button" data-retry>Retry the ${missed.length} you missed</button>` : ''}
      <button class="btn quiet" type="button" data-again>Practice this topic again</button>
      <a class="btn quiet" href="/course/${data.course}/">Back to the course</a>
    </div>`;
  paintDots();
  window.scrollTo({ top: 0 });
}

root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!t) return;
  if (t.dataset.pick !== undefined) choose(Number(t.dataset.pick));
  else if (t.hasAttribute('data-next')) next();
  else if (t.dataset.go !== undefined) {
    idx = Number(t.dataset.go);
    render();
  } else if (t.hasAttribute('data-retry')) {
    const redo = queue.filter((q) => picks.has(q.id) && !isRight(q, picks.get(q.id)!));
    redo.forEach((q) => picks.delete(q.id));
    queue = redo;
    idx = 0;
    render();
  } else if (t.hasAttribute('data-again')) {
    picks.clear();
    queue = order(data.questions);
    idx = 0;
    render();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || summary.hidden === false) return;
  const q = queue[idx];
  const answered = picks.has(q.id);
  const key = e.key.toLowerCase();
  const letter = LETTERS.map((l) => l.toLowerCase()).indexOf(key);
  if (letter >= 0 && !answered) choose(letter);
  else if ((key === 'enter' || key === 'arrowright') && answered) next();
  else if (key === 'arrowleft' && idx > 0) {
    idx -= 1;
    render();
  } else return;
  e.preventDefault();
});

render();
