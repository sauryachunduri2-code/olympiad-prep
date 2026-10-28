import { loadPapers, loadTaggedPapers, paperTitle, physicsTopics } from './papers';

export type CourseId = 'fma' | 'usabo' | 'usnco';

export const COURSES: Record<
  CourseId,
  { id: CourseId; name: string; discipline: string; color: string; art: 'physics' | 'bio' | 'chem'; summary: string }
> = {
  fma: {
    id: 'fma',
    name: 'F=ma',
    discipline: 'Physics',
    color: 'var(--physics)',
    art: 'physics',
    summary: 'The AAPT mechanics exam: 25 multiple-choice questions in 75 minutes. It is the first step toward the US Physics Team.',
  },
  usabo: {
    id: 'usabo',
    name: 'USABO',
    discipline: 'Biology',
    color: 'var(--bio)',
    art: 'bio',
    summary: 'The USA Biology Olympiad Open Exam: 50 multiple-choice questions in 50 minutes across six areas of biology.',
  },
  usnco: {
    id: 'usnco',
    name: 'USNCO',
    discipline: 'Chemistry',
    color: 'var(--chem)',
    art: 'chem',
    summary: 'The US National Chemistry Olympiad, run by the American Chemical Society, from the local exam to the national exam.',
  },
};

export type TopicQuestion = { id: string; label: string; year: number; n: number; partial: boolean };
export type Topic = { slug: string; name: string; questions: TopicQuestion[] };

/** F=ma topics in syllabus order, each with the questions tagged to it. Empty topics are dropped. */
export function fmaTopics(): Topic[] {
  const papers = loadPapers().filter((p) => p.paper.competition_id === 'fma');
  const bySlug = new Map<string, TopicQuestion[]>();
  for (const p of papers) {
    for (const q of p.questions) {
      for (const t of q.topics) {
        const list = bySlug.get(t.slug) ?? [];
        list.push({ id: `${p.id}:${q.number}`, label: `${paperTitle(p)}, question ${q.number}`, year: p.paper.year, n: q.number, partial: t.weight < 1 });
        bySlug.set(t.slug, list);
      }
    }
  }
  return physicsTopics()
    .flatMap((area) => area.subtopics)
    .filter((s) => bySlug.has(s.slug))
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      questions: bySlug.get(s.slug)!.sort((a, b) => b.year - a.year || a.n - b.n),
    }));
}

export const fmaQuestionCount = () =>
  loadPapers()
    .filter((p) => p.paper.competition_id === 'fma')
    .reduce((n, p) => n + p.questions.length, 0);

export const usaboQuestionCount = () =>
  loadTaggedPapers()
    .filter((p) => p.paper.competition_id === 'usabo')
    .reduce((n, p) => n + p.questions.length, 0);
