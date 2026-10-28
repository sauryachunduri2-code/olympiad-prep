import fs from 'node:fs';
import path from 'node:path';

export type Topic = { slug: string; weight: number };
export type Question = {
  number: number;
  stem: string;
  choices: string[] | null;
  answer_index: number;
  also_accepted: number[];
  solution: string;
  figure_ref: string | null;
  format: 'calc' | 'concept' | 'graph' | 'figure';
  difficulty_band: number;
  topics: Topic[];
};
export type Paper = {
  id: string;
  paper: {
    competition_id: string;
    year: number;
    form: string | null;
    source_url: string;
    solutions_url: string;
    question_count: number;
    time_limit_minutes: number;
    constants: string;
  };
  questions: Question[];
};

const root = path.resolve(process.cwd(), '..', 'data');

export const COMPETITIONS: Record<string, { name: string; discipline: string }> = {
  fma: { name: 'F=ma', discipline: 'Physics' },
  usnco: { name: 'USNCO', discipline: 'Chemistry' },
  usabo: { name: 'USABO', discipline: 'Biology' },
};

export function loadPapers(): Paper[] {
  const dir = path.join(root, 'exams');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const { competition_id, year, form } = data.paper;
      return { ...data, id: `${competition_id}-${year}${form ? '-' + form.toLowerCase() : ''}` } as Paper;
    })
    .sort((a, b) => b.paper.year - a.paper.year);
}

export function topicNames(): Record<string, string> {
  const tax = JSON.parse(fs.readFileSync(path.join(root, 'taxonomy', 'physics.json'), 'utf8'));
  return Object.fromEntries(
    tax.topics.flatMap((t: any) => t.subtopics.map((s: any) => [s.slug, s.name])),
  );
}

export function loadUsaboLinks(): {
  open: Record<string, { exam: string; key: string }>;
  semifinal: Record<string, { exam: string; key: string }>;
} {
  return JSON.parse(fs.readFileSync(path.join(root, 'links', 'usabo-official.json'), 'utf8'));
}

export function loadCutoffs() {
  return JSON.parse(fs.readFileSync(path.join(root, 'cutoffs', 'usabo.json'), 'utf8'));
}

export const paperTitle = (p: Paper) =>
  `${COMPETITIONS[p.paper.competition_id].name} ${p.paper.year}${p.paper.form ? ' Exam ' + p.paper.form : ''}`;
