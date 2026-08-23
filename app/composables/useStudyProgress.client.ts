type NoteRow = { body: string, at: string };

export function useStudyProgress() {
  const { $studyStore } = useNuxtApp() as any;
  const reviewed = useState<string[]>('study-reviewed', () => []);
  const notes = useState<Record<string, NoteRow>>('study-notes', () => ({}));
  const loaded = useState('study-progress-loaded', () => false);

  if (!loaded.value) {
    reviewed.value = [...$studyStore.reviewed];
    notes.value = { ...$studyStore.notes };
    loaded.value = true;
    $studyStore.onSync(() => {
      reviewed.value = [...$studyStore.reviewed];
      notes.value = { ...$studyStore.notes };
    });
  }

  function markReviewed(id: string) {
    if (reviewed.value.includes(id)) return;
    $studyStore.markReviewed(id);
    reviewed.value = [...$studyStore.reviewed];
  }

  function unmarkReviewed(id: string) {
    if (!reviewed.value.includes(id)) return;
    $studyStore.unmarkReviewed(id);
    reviewed.value = [...$studyStore.reviewed];
  }

  function toggleReviewed(id: string) {
    if (reviewed.value.includes(id)) unmarkReviewed(id);
    else markReviewed(id);
  }

  function note(id: string) {
    return notes.value[id]?.body || '';
  }

  function saveNote(id: string, body: string) {
    $studyStore.setNote(id, body);
    notes.value = { ...$studyStore.notes };
  }

  return { reviewed, notes, markReviewed, unmarkReviewed, toggleReviewed, note, saveNote };
}
