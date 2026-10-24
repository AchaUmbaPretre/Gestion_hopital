/**
 * Couche offline RDC (phase 1) — point d'entrée unique.
 *  - db.ts         : schéma Dexie (outbox, patients récents, meta)
 *  - outbox.ts     : file d'écriture différée + statut de synchronisation
 *  - syncEngine.ts : déclencheurs du rejeu (online / SW / démarrage / 60 s)
 *  - SyncBadge.tsx : badge visible « N en attente de synchronisation »
 */
export * from './db';
export * from './outbox';
export * from './syncEngine';
export { SyncBadge } from './SyncBadge';
