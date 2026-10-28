import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { getFriendshipPairId } from '../../src/lib/domain/schemas';

describe('Firestore Security Rules Verification', () => {
  let testEnv: RulesTestEnvironment;

  const aliceUid = 'uid_alice_rules';
  const bobUid = 'uid_bob_rules';
  const charlieUid = 'uid_charlie_rules';
  const pairId = getFriendshipPairId(aliceUid, bobUid);

  function validSpot(overrides: Record<string, unknown> = {}) {
    return {
      authorId: aliceUid,
      placeId: 'place_1',
      locationMode: 'exact',
      imagePaths: [`spots/${aliceUid}/spot_new/photo_1.jpg`],
      category: 'cafe',
      priceVnd: null,
      rating: null,
      caption: 'Bài kiểm tra hợp lệ',
      visibility: 'public',
      visitedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active',
      ...overrides,
    };
  }

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
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`users/${aliceUid}`).set({ displayName: 'Alice Rules', createdAt: new Date() });
        await db.doc(`users/${bobUid}`).set({ displayName: 'Bob Rules', createdAt: new Date() });
        await db
          .doc(`users/${charlieUid}`)
          .set({ displayName: 'Charlie Rules', createdAt: new Date() });

        // Quan hệ bạn bè: Alice <-> Bob (bản tra cứu quyền)
        await db
          .doc(`users/${aliceUid}/friends/${bobUid}`)
          .set({ friendUid: bobUid, acceptedAt: new Date() });
        await db
          .doc(`users/${bobUid}/friends/${aliceUid}`)
          .set({ friendUid: aliceUid, acceptedAt: new Date() });
        await db.doc(`friendships/${pairId}`).set({
          senderId: aliceUid,
          receiverId: bobUid,
          status: 'accepted',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 4 Spot của Alice: public, friends, private, đang xóa
        const baseSpot = {
          authorId: aliceUid,
          placeId: 'place_1',
          locationMode: 'exact',
          imagePaths: ['https://example.com/img.jpg'],
          category: 'cafe',
          priceVnd: 30000,
          rating: 5,
          caption: 'Bài của Alice',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active',
        };

        await db
          .doc('spots/spot_alice_public')
          .set({ ...baseSpot, visibility: 'public' });
        await db
          .doc('spots/spot_alice_friends')
          .set({ ...baseSpot, visibility: 'friends' });
        await db
          .doc('spots/spot_alice_private')
          .set({ ...baseSpot, visibility: 'private' });
        await db
          .doc('spots/spot_alice_deleting')
          .set({ ...baseSpot, visibility: 'public', status: 'deleting' });

        // Like docId = UID trên bài public
        await db
          .doc(`spots/spot_alice_public/likes/${bobUid}`)
          .set({ userId: bobUid, createdAt: new Date() });

        // Dữ liệu riêng tư của Alice
        await db.doc(`users/${aliceUid}/privatePlaces/priv_1`).set({
          name: 'Quán bí mật',
          nameNormalized: 'quan bi mat',
          category: 'cafe',
          address: 'Địa chỉ riêng',
          latitude: 21.0,
          longitude: 105.8,
          geohash: 'w3gv',
        });
        await db.doc(`users/${aliceUid}/spotLocations/spot_alice_private`).set({
          placeScope: 'shared',
          placeKey: 'place_1',
        });
        await db.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).set({
          placeScope: 'shared',
          placeId: 'place_1',
          hasVisited: true,
          isBookmarked: true,
          lastVisitedAt: new Date(),
        });
        await db.doc(`users/${aliceUid}/savedPlaces/shared_place_2`).set({
          placeScope: 'shared',
          placeId: 'place_2',
          hasVisited: false,
          isBookmarked: true,
          lastVisitedAt: null,
        });

        // Thông báo do server tạo cho Alice
        await db.doc(`users/${aliceUid}/notifications/notif_1`).set({
          type: 'like',
          actorId: bobUid,
          targetId: 'spot_alice_public',
          isRead: false,
          createdAt: new Date(),
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

    it('Spot đang xóa vẫn đọc được ở cấp tài liệu để không vỡ truy vấn', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      await assertSucceeds(charlieDb.doc('spots/spot_alice_deleting').get());
    });
  });

  describe('Bảo vệ tài liệu riêng tư (Private Subcollections)', () => {
    it('Chỉ Alice mới đọc được privatePlaces, spotLocations, savedPlaces, userSettings của mình', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(aliceDb.doc(`users/${aliceUid}/privatePlaces/priv_1`).get());
      await assertSucceeds(
        aliceDb.doc(`users/${aliceUid}/spotLocations/spot_alice_private`).get()
      );
      await assertSucceeds(aliceDb.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).get());
      await assertSucceeds(aliceDb.doc(`userSettings/${aliceUid}`).get());
    });

    it('Người khác (kể cả bạn bè Bob) bị TỪ CHỐI đọc dữ liệu riêng tư của Alice', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertFails(bobDb.doc(`users/${aliceUid}/privatePlaces/priv_1`).get());
      await assertFails(
        bobDb.doc(`users/${aliceUid}/spotLocations/spot_alice_private`).get()
      );
      await assertFails(bobDb.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).get());
      await assertFails(bobDb.doc(`userSettings/${aliceUid}`).get());
    });
  });

  describe('Spot creation invariants', () => {
    it('Cho phép tạo Spot exact hợp lệ, kể cả giá null hoặc 0', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(aliceDb.doc('spots/spot_new_null_price').set(validSpot()));
      await assertSucceeds(
        aliceDb.doc('spots/spot_new_free').set(validSpot({ priceVnd: 0, rating: 3 }))
      );
    });

    it('Cho phép Spot hidden khi placeId = null, và không cho chứa trường vị trí', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(
        aliceDb.doc('spots/spot_new_hidden').set(
          validSpot({
            placeId: null,
            locationMode: 'hidden',
            imagePaths: [`spots/${aliceUid}/spot_new_hidden/photo_1.jpg`],
          })
        )
      );

      await assertFails(
        aliceDb.doc('spots/spot_invalid_hidden').set(
          validSpot({ placeId: 'place_lo_hang', locationMode: 'hidden' })
        )
      );

      await assertFails(
        aliceDb.doc('spots/spot_leaky_hidden').set(
          validSpot({ placeId: null, locationMode: 'hidden', address: 'Số nhà riêng' })
        )
      );
    });

    it('Từ chối giá/đánh giá sai kiểu hoặc ngoài khoảng', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertFails(
        aliceDb.doc('spots/spot_bad_rating').set(validSpot({ rating: 6 }))
      );
      await assertFails(
        aliceDb.doc('spots/spot_bad_price').set(validSpot({ priceVnd: -1 }))
      );
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

    it('Client không thể tạo, xóa hoặc sửa friendship; chỉ đọc khi là thành viên', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();

      await assertSucceeds(bobDb.doc(`friendships/${pairId}`).get());
      await assertFails(charlieDb.doc(`friendships/${pairId}`).get());
      await assertFails(bobDb.doc(`friendships/${pairId}`).delete());
      await assertFails(
        bobDb.doc('friendships/uid_bob_rules_uid_charlie_rules').set({
          senderId: bobUid,
          receiverId: charlieUid,
          status: 'pending',
        })
      );
    });

    it('Client không thể tự tạo bản ghi notifications cho người khác', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertFails(
        bobDb.doc(`users/${aliceUid}/notifications/fake_notif`).set({
          type: 'like',
          actorId: bobUid,
          targetId: 'spot_alice_public',
          isRead: false,
          createdAt: new Date(),
        })
      );
    });

    it('Người nhận chỉ được đổi isRead của thông báo', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();

      await assertFails(bobDb.doc(`users/${aliceUid}/notifications/notif_1`).get());
      await assertSucceeds(
        aliceDb.doc(`users/${aliceUid}/notifications/notif_1`).update({ isRead: true })
      );
      await assertFails(
        aliceDb
          .doc(`users/${aliceUid}/notifications/notif_1`)
          .update({ actorId: charlieUid })
      );
    });

    it('Like chỉ đọc theo quyền xem Spot; client không được ghi', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      await assertSucceeds(
        bobDb.doc(`spots/spot_alice_public/likes/${bobUid}`).get()
      );
      await assertFails(
        bobDb.doc(`spots/spot_alice_public/likes/${charlieUid}`).set({
          userId: charlieUid,
          createdAt: new Date(),
        })
      );

      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      await assertFails(
        charlieDb.doc(`spots/spot_alice_friends/likes/${bobUid}`).get()
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

    it('Tác giả chỉ đổi được visibility; không sửa nội dung hay status', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();

      await assertSucceeds(
        aliceDb.doc('spots/spot_alice_public').update({
          visibility: 'friends',
          updatedAt: serverTimestamp(),
        })
      );
      await assertFails(
        aliceDb.doc('spots/spot_alice_public').update({
          caption: 'Đổi chú thích',
          updatedAt: serverTimestamp(),
        })
      );
      await assertFails(
        aliceDb.doc('spots/spot_alice_public').update({
          status: 'deleting',
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('Saved Place chỉ xóa được khi không còn lịch sử ghé', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(
        aliceDb.doc(`users/${aliceUid}/savedPlaces/shared_place_2`).delete()
      );
      await assertFails(
        aliceDb.doc(`users/${aliceUid}/savedPlaces/shared_place_1`).delete()
      );
    });

    it('Hồ sơ người dùng từ chối email/uid và trường ngoài schema', async () => {
      const newUid = 'uid_new_rules';
      const newDb = testEnv.authenticatedContext(newUid).firestore();

      await assertSucceeds(
        newDb.doc(`users/${newUid}`).set({
          displayName: 'Người Mới',
          avatarPath: null,
          createdAt: serverTimestamp(),
        })
      );
      await assertFails(
        newDb.doc(`users/${newUid}_bad`).set({
          displayName: 'Người Mới',
          avatarPath: null,
          createdAt: serverTimestamp(),
          email: 'leak@example.com',
        })
      );
    });

    it('Media chỉ ghi được với objectPath khớp UID và spotId của chính mình', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertSucceeds(
        aliceDb.doc('media/spot_new_media_1').set({
          ownerId: aliceUid,
          spotId: 'spot_new_media',
          objectPath: `spots/${aliceUid}/spot_new_media/photo_1.jpg`,
          status: 'attached',
        })
      );
      await assertFails(
        aliceDb.doc('media/spot_new_media_bad').set({
          ownerId: aliceUid,
          spotId: 'spot_new_media',
          objectPath: `spots/${bobUid}/spot_new_media/photo_1.jpg`,
          status: 'attached',
        })
      );
    });
  });

  describe('Place dùng chung', () => {
    it('Người dùng đã đăng nhập đọc được; khách bị từ chối; client không sửa/xóa', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      const guestDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(
        charlieDb.doc('places/place_1').set({
          name: 'Place hợp lệ',
          nameNormalized: 'place hop le',
          category: 'cafe',
          address: '1 Đường Thử',
          latitude: 21.0,
          longitude: 105.8,
          geohash: 'w3gv',
          createdBy: charlieUid,
          createdAt: serverTimestamp(),
        })
      );
      await assertSucceeds(charlieDb.doc('places/place_1').get());
      await assertFails(guestDb.doc('places/place_1').get());
      await assertFails(
        charlieDb.doc('places/place_1').update({ name: 'Đổi tên' })
      );
      await assertFails(charlieDb.doc('places/place_1').delete());
    });
  });
});
