/* Mermaid stays lazy: the large renderer is fetched only after a design article opens. */
const MERMAID_MODULE = '../vendor/mermaid-11.16.1/mermaid.esm.min.mjs';

let enginePromise = null;

function engine() {
  if (!enginePromise) {
    enginePromise = import(MERMAID_MODULE).then(module => {
      const mermaid = module.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        logLevel: 'fatal',
        suppressErrorRendering: true,
        theme: 'base',
        fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
        themeVariables: {
          primaryColor: '#E4F1EB',
          primaryTextColor: '#14233A',
          primaryBorderColor: '#0B6E4F',
          lineColor: '#42536C',
          secondaryColor: '#E7EAF6',
          tertiaryColor: '#F6E8E5',
          background: '#FFFFFF'
        },
        flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: true }
      });
      return mermaid;
    }).catch(error => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

/** Render only diagrams inside the newly mounted article; source remains visible on failure. */
export async function mountMermaidDiagrams(root) {
  const nodes = [...root.querySelectorAll('[data-mermaid-diagram]')];
  if (!nodes.length) return true;
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const mermaid = await engine();
    await mermaid.run({ nodes, suppressErrors: true });
    nodes.forEach(node => node.closest('[data-diagram-frame]')?.classList.add('is-rendered'));
    return true;
  } catch (error) {
    nodes.forEach(node => {
      const frame = node.closest('[data-diagram-frame]');
      frame?.classList.add('is-source-only');
      const status = frame?.querySelector('[data-mermaid-status]');
      if (status) status.hidden = false;
    });
    return false;
  }
}
