import { adminAuth, adminDb } from '../src/lib/firebase/admin';
import { geohashForLocation } from 'geofire-common';
import { normalizeVietnamese, getFriendshipPairId, getSavedPlaceKey } from '../src/lib/domain/schemas';

async function seed() {
  console.log('🚀 Bắt đầu nạp dữ liệu mẫu (Seed Data) cho Rocket24h...');

  // 1. Tạo 3 người dùng mẫu
  const demoUsers = [
    {
      uid: 'uid_alice_001',
      email: 'demo_user1@rocket24h.vn',
      displayName: 'Alice Hoàng',
      avatarPath: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    {
      uid: 'uid_bob_002',
      email: 'demo_user2@rocket24h.vn',
      displayName: 'Bob Nguyễn',
      avatarPath: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      uid: 'uid_charlie_003',
      email: 'demo_user3@rocket24h.vn',
      displayName: 'Charlie Đặng',
      avatarPath: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  ];

  for (const u of demoUsers) {
    try {
      await adminAuth.createUser({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        password: 'Password123!',
      });
      console.log(`  ✓ Tạo Auth User: ${u.email} (${u.uid})`);
    } catch {
      console.log(`  ℹ Auth User ${u.email} đã tồn tại`);
    }

    // Ghi profile Firestore
    await adminDb.doc(`users/${u.uid}`).set({
      displayName: u.displayName,
      avatarPath: u.avatarPath,
      createdAt: new Date(),
    });

    // Cài đặt mặc định
    await adminDb.doc(`userSettings/${u.uid}`).set({
      defaultVisibility: 'friends',
      notificationEnabled: true,
    });
  }

  // 2. Tạo quan hệ bạn bè giữa Alice & Bob
  const pairIdAliceBob = getFriendshipPairId('uid_alice_001', 'uid_bob_002');
  const now = new Date();

  await adminDb.doc(`friendships/${pairIdAliceBob}`).set({
    senderId: 'uid_alice_001',
    receiverId: 'uid_bob_002',
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
  });

  // Bản tra cứu quyền nhanh
  await adminDb.doc(`users/uid_alice_001/friends/uid_bob_002`).set({
    friendUid: 'uid_bob_002',
    acceptedAt: now,
  });
  await adminDb.doc(`users/uid_bob_002/friends/uid_alice_001`).set({
    friendUid: 'uid_alice_001',
    acceptedAt: now,
  });
  console.log('  ✓ Đã thiết lập quan hệ bạn bè: Alice <-> Bob');

  // 3. Tạo 10 Places tại Hà Nội
  const rawPlaces = [
    {
      id: 'place_trangtien_icecream',
      name: 'Kem Tràng Tiền',
      category: 'street_food',
      address: '35 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      latitude: 21.025345,
      longitude: 105.854812,
      createdBy: 'uid_alice_001',
    },
    {
      id: 'place_giang_cafe',
      name: 'Cà phê Giảng (Cafe Trứng)',
      category: 'cafe',
      address: '39 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội',
      latitude: 21.034182,
      longitude: 105.853284,
      createdBy: 'uid_bob_002',
    },
    {
      id: 'place_pho_10_lyquocsu',
      name: 'Phở 10 Lý Quốc Sư',
      category: 'restaurant',
      address: '10 Lý Quốc Sư, Hàng Trống, Hoàn Kiếm, Hà Nội',
      latitude: 21.030588,
      longitude: 105.849202,
      createdBy: 'uid_alice_001',
    },
    {
      id: 'place_banhmi_25',
      name: 'Bánh Mì 25',
      category: 'street_food',
      address: '25 Hàng Cá, Hàng Đào, Hoàn Kiếm, Hà Nội',
      latitude: 21.036214,
      longitude: 105.849852,
      createdBy: 'uid_bob_002',
    },
    {
      id: 'place_loading_t_cafe',
      name: 'Loading T Café',
      category: 'cafe',
      address: '8 Chân Cầm, Hàng Trống, Hoàn Kiếm, Hà Nội',
      latitude: 21.030822,
      longitude: 105.849411,
      createdBy: 'uid_alice_001',
    },
    {
      id: 'place_bun_cha_huonglien',
      name: 'Bún Chả Hương Liên (Obama)',
      category: 'restaurant',
      address: '24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội',
      latitude: 21.017511,
      longitude: 105.853822,
      createdBy: 'uid_charlie_003',
    },
    {
      id: 'place_ho_tay_chua_tran_quoc',
      name: 'Chùa Trấn Quốc & Hồ Tây',
      category: 'tourism',
      address: 'Đường Thanh Niên, Yên Phụ, Tây Hồ, Hà Nội',
      latitude: 21.047812,
      longitude: 105.836814,
      createdBy: 'uid_alice_001',
    },
    {
      id: 'place_nha_tho_lon',
      name: 'Nhà Thờ Lớn Hà Nội',
      category: 'tourism',
      address: '40 Nhà Chung, Hàng Trống, Hoàn Kiếm, Hà Nội',
      latitude: 21.028789,
      longitude: 105.849015,
      createdBy: 'uid_bob_002',
    },
    {
      id: 'place_polite_co_cocktail',
      name: 'Polite & Co Cocktail Bar',
      category: 'nightlife',
      address: '5B Bảo Khánh, Hàng Trống, Hoàn Kiếm, Hà Nội',
      latitude: 21.030114,
      longitude: 105.852441,
      createdBy: 'uid_charlie_003',
    },
    {
      id: 'place_cha_ca_thang_long',
      name: 'Chả Cá Thăng Long',
      category: 'restaurant',
      address: '21 Đường Thành, Cửa Đông, Hoàn Kiếm, Hà Nội',
      latitude: 21.034511,
      longitude: 105.846512,
      createdBy: 'uid_bob_002',
    },
  ];

  for (const p of rawPlaces) {
    const hash = geohashForLocation([p.latitude, p.longitude]);
    await adminDb.doc(`places/${p.id}`).set({
      name: p.name,
      nameNormalized: normalizeVietnamese(p.name),
      category: p.category,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      geohash: hash,
      createdBy: p.createdBy,
      createdAt: now,
    });
  }
  console.log(`  ✓ Đã nạp ${rawPlaces.length} địa điểm dùng chung tại Hà Nội`);

  // 4. Tạo 15 Spots với đa dạng phạm vi: public, friends, private, locationMode exact & hidden
  const sampleSpots = [
    {
      id: 'spot_001',
      authorId: 'uid_alice_001',
      placeId: 'place_trangtien_icecream',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600'],
      category: 'street_food',
      priceVnd: 15000,
      rating: 5,
      caption: 'Kem ốc quế Tràng Tiền vị cốm chuẩn truyền thống, mát rượi ngày hè!',
      visibility: 'public',
      visitedAt: new Date(Date.now() - 86400000 * 2),
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      id: 'spot_002',
      authorId: 'uid_alice_001',
      placeId: 'place_giang_cafe',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600'],
      category: 'cafe',
      priceVnd: 35000,
      rating: 5,
      caption: 'Cà phê trứng béo ngậy thơm lừng, ngắm phố cổ buổi sáng thật yên bình.',
      visibility: 'friends',
      visitedAt: new Date(Date.now() - 86400000 * 3),
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: 'spot_003',
      authorId: 'uid_alice_001',
      placeId: null, // HIDDEN location
      locationMode: 'hidden',
      imagePaths: ['https://images.unsplash.com/photo-1544025162-d76694265947?w=600'],
      category: 'street_food',
      priceVnd: 40000,
      rating: 4,
      caption: 'Quán ăn bí mật gần nhà cực kỳ ngon nhưng mình xin phép ẩn vị trí nhé!',
      visibility: 'public',
      visitedAt: new Date(Date.now() - 86400000 * 4),
      createdAt: new Date(Date.now() - 86400000 * 4),
      updatedAt: new Date(Date.now() - 86400000 * 4),
      // Bổ sung bản ghi thực tế trong spotLocations
      secretLocation: { placeScope: 'shared', placeKey: 'place_pho_10_lyquocsu' },
    },
    {
      id: 'spot_004',
      authorId: 'uid_alice_001',
      placeId: 'place_loading_t_cafe',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600'],
      category: 'cafe',
      priceVnd: 55000,
      rating: 4,
      caption: 'Nhật ký cá nhân: Góc làm việc yên tĩnh số 1 khu Chân Cầm.',
      visibility: 'private',
      visitedAt: new Date(Date.now() - 86400000 * 5),
      createdAt: new Date(Date.now() - 86400000 * 5),
      updatedAt: new Date(Date.now() - 86400000 * 5),
    },
    {
      id: 'spot_005',
      authorId: 'uid_bob_002',
      placeId: 'place_banhmi_25',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600'],
      category: 'street_food',
      priceVnd: 30000,
      rating: 5,
      caption: 'Bánh mì giòn rụm, pate béo và thịt xá xíu đậm đà, rất đông khách Tây.',
      visibility: 'public',
      visitedAt: new Date(Date.now() - 86400000 * 1),
      createdAt: new Date(Date.now() - 86400000 * 1),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    },
    {
      id: 'spot_006',
      authorId: 'uid_bob_002',
      placeId: 'place_pho_10_lyquocsu',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600'],
      category: 'restaurant',
      priceVnd: 75000,
      rating: 4,
      caption: 'Phở bò tái lăn nước dùng thanh ngọt, thịt mềm, quẩy giòn tan.',
      visibility: 'friends',
      visitedAt: new Date(Date.now() - 86400000 * 2),
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      id: 'spot_007',
      authorId: 'uid_bob_002',
      placeId: 'place_cha_ca_thang_long',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1559847844-5315695dadae?w=600'],
      category: 'restaurant',
      priceVnd: 180000,
      rating: 5,
      caption: 'Chả cá lăng thơm lừng thì là hành hoa, ăn cùng bún và mắm tôm chuẩn vị.',
      visibility: 'public',
      visitedAt: new Date(Date.now() - 86400000 * 6),
      createdAt: new Date(Date.now() - 86400000 * 6),
      updatedAt: new Date(Date.now() - 86400000 * 6),
    },
    {
      id: 'spot_008',
      authorId: 'uid_charlie_003',
      placeId: 'place_bun_cha_huonglien',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600'],
      category: 'restaurant',
      priceVnd: 60000,
      rating: 4,
      caption: 'Bún chả Hương Liên, chả nướng than hoa thơm nức mũi.',
      visibility: 'public',
      visitedAt: new Date(Date.now() - 86400000 * 3),
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: 'spot_009',
      authorId: 'uid_charlie_003',
      placeId: 'place_polite_co_cocktail',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600'],
      category: 'nightlife',
      priceVnd: 220000,
      rating: 5,
      caption: 'Cocktail Hanoi Autumn hương cốm và quế rất tinh tế, không gian cổ điển.',
      visibility: 'friends',
      visitedAt: new Date(Date.now() - 86400000 * 4),
      createdAt: new Date(Date.now() - 86400000 * 4),
      updatedAt: new Date(Date.now() - 86400000 * 4),
    },
    {
      id: 'spot_010',
      authorId: 'uid_alice_001',
      placeId: 'place_ho_tay_chua_tran_quoc',
      locationMode: 'exact',
      imagePaths: ['https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600'],
      category: 'tourism',
      priceVnd: 0, // 0 = miễn phí
      rating: 5,
      caption: 'Hoàng hôn Hồ Tây nhìn từ đường Thanh Niên đẹp đến ngỡ ngàng.',
      visibility: 'public',
      visitedAt: new Date(Date.now() - 86400000 * 7),
      createdAt: new Date(Date.now() - 86400000 * 7),
      updatedAt: new Date(Date.now() - 86400000 * 7),
    },
  ];

  for (const s of sampleSpots) {
    const { secretLocation, ...spotData } = s as typeof s & { secretLocation?: { placeScope: string; placeKey: string } };
    await adminDb.doc(`spots/${s.id}`).set({ ...spotData, status: 'active' });

    // Nếu là spot hidden, lưu liên kết thật vào users/{authorUid}/spotLocations/{spotId}
    if (secretLocation) {
      await adminDb.doc(`users/${s.authorId}/spotLocations/${s.id}`).set(secretLocation);
    }

    // Nếu spot có placeId, ghi nhận savedPlaces: hasVisited = true
    if (s.placeId) {
      const key = getSavedPlaceKey('shared', s.placeId);
      await adminDb.doc(`users/${s.authorId}/savedPlaces/${key}`).set({
        placeScope: 'shared',
        placeId: s.placeId,
        hasVisited: true,
        isBookmarked: false,
        lastVisitedAt: s.visitedAt,
      });
    }
  }
  console.log(`  ✓ Đã nạp ${sampleSpots.length} bài trải nghiệm (Spots)`);

  // Thêm 1 like mẫu từ Bob cho bài của Alice
  await adminDb.doc(`spots/spot_001/likes/uid_bob_002`).set({
    userId: 'uid_bob_002',
    createdAt: new Date(),
  });
  console.log('  ✓ Đã thêm 1 lượt thích mẫu (Bob -> Alice spot_001)');

  console.log('\n🎉 Hoàn thành nạp dữ liệu mẫu! Tất cả tài khoản đã sẵn sàng:');
  console.log('   - Alice:   demo_user1@rocket24h.vn / Password123!');
  console.log('   - Bob:     demo_user2@rocket24h.vn / Password123!');
  console.log('   - Charlie: demo_user3@rocket24h.vn / Password123!');
}

seed().catch((err) => {
  console.error('❌ Lỗi khi nạp dữ liệu mẫu:', err);
  process.exit(1);
});
