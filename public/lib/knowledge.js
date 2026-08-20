import { createCollection } from './collection.js';

/* Material outside interview preparation. Each subject is its own collection so
   its numbering starts at 01 and its categories mean something local — sharing
   one manifest would put "Photography 07" next to "NAS 08" for no reason. */
export const KNOWLEDGE = Object.freeze({
  photography: createCollection('data/photography/'),
  homelab: createCollection('data/homelab/')
});

/** Route id → collection. */
export function knowledgeCollection(id) {
  return KNOWLEDGE[id] || null;
}
