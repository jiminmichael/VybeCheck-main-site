import type { SongRequestItem } from '../types';

// Accepted requests play before pending requests; VIP leads within each group.
export function compareQueue(a: SongRequestItem, b: SongRequestItem) {
  return Number(b.status === 'up_next') - Number(a.status === 'up_next')
    || Number(b.priority) - Number(a.priority)
    || a.queuePosition - b.queuePosition || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
export function activeQueue(requests: SongRequestItem[]) {
  return requests.filter(r => r.status === 'pending' || r.status === 'up_next').sort(compareQueue);
}
