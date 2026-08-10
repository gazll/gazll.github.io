/** Copy text from a direct user action, including local HTTP previews. */
export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopyText(text));
  }
  return legacyCopyText(text);
}

function legacyCopyText(text) {
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    ta.remove();
    copied ? resolve() : reject(new Error('clipboard blocked'));
  });
}
