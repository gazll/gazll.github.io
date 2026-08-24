const topLevelHeading = /^#\s+(.+?)\s*#*$/;

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

/* Split only real level-one headings. A line such as `# English Learning
   Ledger` inside a fenced dashboard must remain part of that dashboard. */
function findHeadings(lines) {
  const headings = [];
  let inFence = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) {
      const match = topLevelHeading.exec(line);
      if (match) headings.push({ line: index, title: match[1].trim() });
    }
  });

  return headings;
}

export function parseEnglishStudyPlan(markdown) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const headings = findHeadings(lines);
  if (!headings.length) return { title: 'English Study', intro: '', sections: [] };

  const first = headings[0];
  const title = first.title;
  const introEnd = headings[1]?.line ?? lines.length;
  const sections = headings.slice(1).map((heading, index) => {
    const end = headings[index + 2]?.line ?? lines.length;
    const number = /^(\d+)\./.exec(heading.title)?.[1] || String(index + 1);
    return {
      id: `english-study-${number}-${slugify(heading.title)}`,
      number: String(number).padStart(2, '0'),
      title: heading.title,
      markdown: lines.slice(heading.line + 1, end).join('\n').trim()
    };
  });

  return {
    title,
    intro: lines.slice(first.line + 1, introEnd).join('\n').trim(),
    sections
  };
}
