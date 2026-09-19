/**
 * TripSidebarPanel and TripDetailPage each fetch the same trip independently
 * (they're siblings in the component tree, not parent/child), so a mutation
 * made in one — add a member, change currency — doesn't refresh the other's
 * copy on its own. This is a minimal pub-sub to bridge that: whoever mutates
 * trip data calls notifyTripChanged, whoever displays it subscribes.
 */
type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export function notifyTripChanged(tripId: string) {
  listeners.get(tripId)?.forEach((fn) => fn());
}

/** Subscribes `fn` to changes for `tripId`; call the returned function to unsubscribe. */
export function onTripChanged(tripId: string, fn: Listener): () => void {
  if (!listeners.has(tripId)) listeners.set(tripId, new Set());
  listeners.get(tripId)!.add(fn);
  return () => listeners.get(tripId)?.delete(fn);
}
