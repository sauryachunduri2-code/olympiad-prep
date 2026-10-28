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
    round: string;
    form: string | null;
    source_url: string;
    solutions_url: string;
    key_url?: string;
    storage_policy: 'full' | 'tags_only';
    question_count: number;
    time_limit_minutes: number;
    constants: string;
  };
  questions: Question[];
};
export type TaggedQuestion = {
  number: number;
  format: 'recall' | 'reasoning' | 'calc' | 'data';
  topics: Topic[];
  skills: string[];
  group: string | null;
};

const root = path.resolve(process.cwd(), '..', 'data');

export const COMPETITIONS: Record<string, { name: string; discipline: string }> = {
  fma: { name: 'F=ma', discipline: 'Physics' },
  usnco: { name: 'USNCO', discipline: 'Chemistry' },
  usabo: { name: 'USABO', discipline: 'Biology' },
};

function readExams(): Paper[] {
  const dir = path.join(root, 'exams');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const { competition_id, year, round, form } = data.paper;
      const id = `${competition_id}-${year}${round === 'open' ? '-open' : ''}${form ? '-' + form.toLowerCase() : ''}`;
      return { ...data, id } as Paper;
    })
    .sort((a, b) => b.paper.year - a.paper.year);
}

/** Papers whose questions are stored in full and can be sat on the site. */
export const loadPapers = (): Paper[] => readExams().filter((p) => p.paper.storage_policy === 'full');

/** Papers kept as topic tags only (USABO): no question text exists in the repo. */
export const loadTaggedPapers = (): Paper[] => readExams().filter((p) => p.paper.storage_policy === 'tags_only');

function taxonomy(discipline: string) {
  return JSON.parse(fs.readFileSync(path.join(root, 'taxonomy', `${discipline}.json`), 'utf8'));
}

export function topicNames(): Record<string, string> {
  return Object.fromEntries(
    ['physics', 'biology'].flatMap((d) =>
      taxonomy(d).topics.flatMap((t: any) => t.subtopics.map((s: any) => [s.slug, s.name])),
    ),
  );
}

/** Biology topics with their subtopics, in syllabus order. */
export const biologyTopics = (): { slug: string; name: string; subtopics: { slug: string; name: string }[] }[] =>
  taxonomy('biology').topics;

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
