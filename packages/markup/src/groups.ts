// Fork addition: groups inside groups. `groupId` is the outermost group (selection, moving and
// the Bluebeam export all use it); `innerGroups` lists the groups nested in it, outer to inner.
import type { Markup } from './model';

/** The group ids of a markup, outermost first. */
export function groupChain(m: Pick<Markup, 'groupId' | 'innerGroups'>): string[] {
  return m.groupId ? [m.groupId, ...(m.innerGroups ?? [])] : [];
}

/** The markup's groups with every id replaced by `groupOf(id)` (for a copy that gets groups of its own). */
export function regroup(m: Pick<Markup, 'groupId' | 'innerGroups'>, groupOf: (id: string) => string): Pick<Markup, 'groupId' | 'innerGroups'> {
  const [outer, ...inner] = groupChain(m).map(groupOf);
  return { groupId: outer, innerGroups: inner.length ? inner : undefined };
}

/** Wraps the markup in one more group. */
export function addOuterGroup(m: Pick<Markup, 'groupId' | 'innerGroups'>, groupId: string): Pick<Markup, 'groupId' | 'innerGroups'> {
  const chain = groupChain(m);
  return { groupId, innerGroups: chain.length ? chain : undefined };
}

/** Takes the markup out of its outermost group only; the groups inside it stay. */
export function removeOuterGroup(m: Pick<Markup, 'groupId' | 'innerGroups'>): Pick<Markup, 'groupId' | 'innerGroups'> {
  const [, next, ...rest] = groupChain(m);
  return { groupId: next, innerGroups: rest.length ? rest : undefined };
}
