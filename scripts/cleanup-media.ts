import {
  adminDb,
  adminStorage,
  Timestamp,
} from '../src/lib/firebase/admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

const DEFAULT_AGE_HOURS = 24;
const MAX_RECORDS_PER_RUN = 500;

function getCutoff(): Date {
  const configuredHours = Number(process.env.MEDIA_CLEANUP_AGE_HOURS ?? DEFAULT_AGE_HOURS);
  if (!Number.isFinite(configuredHours) || configuredHours < 0) {
    throw new Error('MEDIA_CLEANUP_AGE_HOURS phải là số không âm');
  }

  return new Date(Date.now() - configuredHours * 60 * 60 * 1000);
}

function isOlderThanCutoff(value: unknown, cutoff: Date): boolean {
  if (!value) return true;
  if (value instanceof Timestamp) return value.toDate() <= cutoff;
  if (value instanceof Date) return value <= cutoff;
  return false;
}

async function removeMediaRecord(
  doc: QueryDocumentSnapshot,
): Promise<void> {
  const data = doc.data();
  const objectPath = typeof data.objectPath === 'string' ? data.objectPath : '';

  if (objectPath && !/^https?:\/\//i.test(objectPath)) {
    await adminStorage.bucket().file(objectPath).delete({ ignoreNotFound: true });
  }

  await doc.ref.delete();
}

async function cleanupMedia(): Promise<void> {
  const cutoff = getCutoff();
  const snapshot = await adminDb
    .collection('media')
    .where('status', 'in', ['temp', 'orphan'])
    .limit(MAX_RECORDS_PER_RUN)
    .get();

  let removed = 0;
  let skipped = 0;

  for (const mediaDoc of snapshot.docs) {
    if (!isOlderThanCutoff(mediaDoc.data().createdAt, cutoff)) {
      skipped += 1;
      continue;
    }

    await removeMediaRecord(mediaDoc);
    removed += 1;
  }

  console.log(
    JSON.stringify({
      removed,
      skipped,
      scanned: snapshot.size,
      hasMore: snapshot.size === MAX_RECORDS_PER_RUN,
    })
  );
}

cleanupMedia().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : 'Không thể dọn media tạm',
    })
  );
  process.exitCode = 1;
});
