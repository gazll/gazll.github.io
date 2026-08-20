/* One owner per mechanism: the renderer ships from public/lib/markdown.js,
   which the standalone modules and the tools import too. This is the Nuxt
   auto-import surface for it, never a second copy — a fork would let the SENT
   sentinel and the escaping rules drift between the two. */
export { escapeHtml, inlineUser, renderMarkdown, renderUser } from '../../public/lib/markdown.js';
