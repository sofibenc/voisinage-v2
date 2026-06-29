import { describe, it, expect } from 'vitest';
import { buildNotifPayload, adminsWithTokens } from '../../functions/lib/notif.js';

describe('buildNotifPayload', () => {
  it('title is always "Voisinage"', () => {
    expect(buildNotifPayload('Alice').notification.title).toBe('Voisinage');
  });

  it('body includes name', () => {
    expect(buildNotifPayload('Alice').notification.body)
      .toBe('Nouveau voisin en attente — Alice demande à rejoindre');
  });

  it('webpush notification has icon', () => {
    expect(buildNotifPayload('Bob').webpush.notification.icon).toBe('/icon-192.png');
  });

  it('uses fallback name when empty string', () => {
    expect(buildNotifPayload('').notification.body)
      .toBe('Nouveau voisin en attente — Nouveau voisin demande à rejoindre');
  });
});

describe('adminsWithTokens', () => {
  it('keeps only members with a truthy fcmToken', () => {
    const docs = [
      { ref: 'r1', fcmToken: 'tok-a' },
      { ref: 'r2', fcmToken: null },
      { ref: 'r3' },
      { ref: 'r4', fcmToken: 'tok-d' },
    ];
    const result = adminsWithTokens(docs);
    expect(result).toEqual([
      { ref: 'r1', fcmToken: 'tok-a' },
      { ref: 'r4', fcmToken: 'tok-d' },
    ]);
  });

  it('returns empty array when no tokens', () => {
    expect(adminsWithTokens([{ ref: 'r1' }])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(adminsWithTokens([])).toEqual([]);
  });
});
