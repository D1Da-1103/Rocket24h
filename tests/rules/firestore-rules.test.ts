import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules Verification', () => {
  let testEnv: RulesTestEnvironment;

  const aliceUid = 'uid_alice_rules';
  const bobUid = 'uid_bob_rules';
  const charlieUid = 'uid_charlie_rules';

  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'rocket24h-rules-test',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();

      // Thiết lập dữ liệu nền với quyền admin (bỏ qua rules):
      // 1. Hồ sơ Alice, Bob, Charlie
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`users/${aliceUid}`).set({ displayName: 'Alice Rules', createdAt: new Date() });
        await db.doc(`users/${bobUid}`).set({ displayName: 'Bob Rules', createdAt: new Date() });
        await db.doc(`users/${charlieUid}`).set({ displayName: 'Charlie Rules', createdAt: new Date() });

        // 2. Thiết lập quan hệ bạn bè: Alice <-> Bob (bản tra cứu quyền)
        await db.doc(`users/${aliceUid}/friends/${bobUid}`).set({ friendUid: bobUid, acceptedAt: new Date() });
        await db.doc(`users/${bobUid}/friends/${aliceUid}`).set({ friendUid: aliceUid, acceptedAt: new Date() });

        // 3. Tạo 3 Spot của Alice (public, friends, private)
        await db.doc('spots/spot_alice_public').set({
          authorId: aliceUid,
          placeId: 'place_1',
          locationMode: 'exact',
          imagePaths: ['https://example.com/img1.jpg'],
          category: 'cafe',
          priceVnd: 30000,
          rating: 5,
          caption: 'Bài public của Alice',
          visibility: 'public',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.doc('spots/spot_alice_friends').set({
          authorId: aliceUid,
          placeId: 'place_1',
          locationMode: 'exact',
          imagePaths: ['https://example.com/img2.jpg'],
          category: 'cafe',
          priceVnd: 30000,
          rating: 4,
          caption: 'Bài friends của Alice',
          visibility: 'friends',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.doc('spots/spot_alice_private').set({
          authorId: aliceUid,
          placeId: 'place_1',
          locationMode: 'exact',
          imagePaths: ['https://example.com/img3.jpg'],
          category: 'cafe',
          priceVnd: 50000,
          rating: 5,
          caption: 'Bài private của Alice',
          visibility: 'private',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 4. Tài liệu riêng tư của Alice
        await db.doc(`users/${aliceUid}/privatePlaces/priv_1`).set({
          name: 'Quán bí mật',
          latitude: 21.0,
          longitude: 105.8,
        });
        await db.doc(`users/${aliceUid}/spotLocations/spot_alice_private`).set({
          placeScope: 'shared',
          placeKey: 'place_1',
        });
        await db.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).set({
          placeId: 'place_1',
          hasVisited: true,
          isBookmarked: true,
        });
        await db.doc(`userSettings/${aliceUid}`).set({
          defaultVisibility: 'friends',
          notificationEnabled: true,
        });
      });
    }
  });

  describe('Ma trận phân quyền đọc Spot (Read Matrix)', () => {
    it('Tác giả (Alice) đọc được tất cả: public, friends, private', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(aliceDb.doc('spots/spot_alice_public').get());
      await assertSucceeds(aliceDb.doc('spots/spot_alice_friends').get());
      await assertSucceeds(aliceDb.doc('spots/spot_alice_private').get());
    });

    it('Bạn bè đã chấp nhận (Bob) đọc được public và friends, nhưng bị TỪ CHỐI private', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertSucceeds(bobDb.doc('spots/spot_alice_public').get());
      await assertSucceeds(bobDb.doc('spots/spot_alice_friends').get());
      await assertFails(bobDb.doc('spots/spot_alice_private').get());
    });

    it('Thành viên khác chưa kết bạn (Charlie) chỉ đọc được public, bị TỪ CHỐI friends và private', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      await assertSucceeds(charlieDb.doc('spots/spot_alice_public').get());
      await assertFails(charlieDb.doc('spots/spot_alice_friends').get());
      await assertFails(charlieDb.doc('spots/spot_alice_private').get());
    });

    it('Khách chưa đăng nhập (Unauthenticated) bị TỪ CHỐI mọi Spot', async () => {
      const guestDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(guestDb.doc('spots/spot_alice_public').get());
      await assertFails(guestDb.doc('spots/spot_alice_friends').get());
      await assertFails(guestDb.doc('spots/spot_alice_private').get());
    });
  });

  describe('Bảo vệ tài liệu riêng tư (Private Subcollections)', () => {
    it('Chỉ Alice mới đọc được privatePlaces, spotLocations, savedPlaces, userSettings của mình', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(aliceDb.doc(`users/${aliceUid}/privatePlaces/priv_1`).get());
      await assertSucceeds(aliceDb.doc(`users/${aliceUid}/spotLocations/spot_alice_private`).get());
      await assertSucceeds(aliceDb.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).get());
      await assertSucceeds(aliceDb.doc(`userSettings/${aliceUid}`).get());
    });

    it('Người khác (kể cả bạn bè Bob) bị TỪ CHỐI đọc dữ liệu riêng tư của Alice', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertFails(bobDb.doc(`users/${aliceUid}/privatePlaces/priv_1`).get());
      await assertFails(bobDb.doc(`users/${aliceUid}/spotLocations/spot_alice_private`).get());
      await assertFails(bobDb.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).get());
      await assertFails(bobDb.doc(`userSettings/${aliceUid}`).get());
    });
  });

  describe('Bất biến và bất khả xâm phạm từ phía Client', () => {
    it('Client không thể tự ghi vào bảng tra cứu friends (chỉ server ghi)', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertFails(
        bobDb.doc(`users/${aliceUid}/friends/${bobUid}`).set({
          friendUid: bobUid,
          acceptedAt: new Date(),
        })
      );
    });

    it('Client không thể tự tạo bản ghi notifications cho người khác', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertFails(
        bobDb.doc(`users/${aliceUid}/notifications/fake_notif`).set({
          type: 'like',
          actorId: bobUid,
          isRead: false,
        })
      );
    });

    it('Người dùng không thể sửa hoặc xóa Spot của người khác', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertFails(
        bobDb.doc('spots/spot_alice_public').update({
          caption: 'Bob đã hack bài của Alice',
        })
      );
      await assertFails(bobDb.doc('spots/spot_alice_public').delete());
    });

    it('Từ chối Spot có locationMode = "hidden" nhưng placeId != null', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertFails(
        aliceDb.doc('spots/invalid_hidden_spot').set({
          authorId: aliceUid,
          placeId: 'place_lo_hang', // Sai quy định: khi hidden thì placeId phải là null
          locationMode: 'hidden',
          imagePaths: ['https://example.com/1.jpg'],
          category: 'cafe',
          priceVnd: 20000,
          rating: 4,
          caption: 'Bài sai quy tắc',
          visibility: 'public',
        })
      );
    });
  });
});
