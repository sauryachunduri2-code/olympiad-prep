// Copy the figure crops next to the site so Astro serves them. The JSON itself is read at build time.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const from = new URL('../../data/exams/figures/', import.meta.url);
const to = new URL('../public/figures/', import.meta.url);
if (!existsSync(from)) throw new Error('data/exams/figures not found');
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
