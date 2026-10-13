import type { EventItem, DJProfile } from '../types';
export function resolveEventId(events: EventItem[], djs: DJProfile[], slug: string, currentId: string, ownDJId?: string) {
  if (slug) {
    const dj = djs.find(d => d.handle === slug);
    const linked = dj ? events.find(e => e.djId === dj.id && e.isActive) || events.find(e => e.djId === dj.id) : events.find(e => e.slug === slug);
    return linked?.id || '';
  }
  return events.find(e => e.id === currentId)?.id || events.find(e => e.djId === ownDJId)?.id || events[0]?.id || '';
}
