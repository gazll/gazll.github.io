/* Mermaid stays lazy: the large renderer is fetched only after a design article opens. */
const MERMAID_MODULE = '../vendor/mermaid-11.16.1/mermaid.esm.min.mjs';

let enginePromise = null;

/* Mermaid derives its shades from hex input and cannot read CSS variables, so
   the MD3 roles are read off <html> at render time. The generated roles are
   plain hex, and reading them per render is what lets a theme switch reach the
   next diagram drawn. Fallbacks are the light roles, for a page without CSS. */
function themeVariables() {
  const style = getComputedStyle(document.documentElement);
  const role = (name, fallback) => style.getPropertyValue(`--md-sys-color-${name}`).trim() || fallback;
  return {
    darkMode: style.colorScheme === 'dark',
    primaryColor: role('secondary-container', '#CFE9D9'),
    primaryTextColor: role('on-surface', '#171D1A'),
    primaryBorderColor: role('primary', '#1E6A4F'),
    lineColor: role('on-surface-variant', '#404944'),
    secondaryColor: role('tertiary-container', '#C1E8FB'),
    tertiaryColor: role('surface-container-high', '#E4EAE4'),
    background: role('surface-container-lowest', '#FFFFFF'),
    mainBkg: role('secondary-container', '#CFE9D9'),
    clusterBkg: role('surface-container-low', '#EFF5EF'),
    clusterBorder: role('outline-variant', '#BFC9C2'),
    titleColor: role('on-surface', '#171D1A'),
    edgeLabelBackground: role('surface-container-lowest', '#FFFFFF')
  };
}

function configure(mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    logLevel: 'fatal',
    suppressErrorRendering: true,
    theme: 'base',
    fontFamily: '"Roboto Flex Variable", system-ui, sans-serif',
    themeVariables: themeVariables(),
    flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: true }
  });
}

function engine() {
  if (!enginePromise) {
    enginePromise = import(MERMAID_MODULE).then(module => {
      const mermaid = module.default;
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
    // Font readiness and the lazy vendor download are independent. Starting
    // both together removes a needless waterfall on the first blueprint open,
    // while still waiting for the final font metrics before layout is painted.
    const mermaidPromise = engine();
    const mermaid = document.fonts?.ready
      ? (await Promise.all([mermaidPromise, document.fonts.ready]))[0]
      : await mermaidPromise;
    configure(mermaid);
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
