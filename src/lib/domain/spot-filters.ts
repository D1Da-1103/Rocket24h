import { Spot } from './types';
import { normalizeVietnamese } from './schemas';

export type PriceFilter = 'any' | 'free' | 'under50' | '50to150' | 'over150';

export interface SpotFilters {
  searchTerm: string;
  category: string | null;
  price: PriceFilter;
  minRating: number | null;
}

export const DEFAULT_SPOT_FILTERS: SpotFilters = {
  searchTerm: '',
  category: null,
  price: 'any',
  minRating: null,
};

function matchesPrice(priceVnd: number | null, filter: PriceFilter): boolean {
  if (filter === 'any') return true;
  if (priceVnd === null) return false;
  switch (filter) {
    case 'free':
      return priceVnd === 0;
    case 'under50':
      return priceVnd > 0 && priceVnd < 50000;
    case '50to150':
      return priceVnd >= 50000 && priceVnd <= 150000;
    case 'over150':
      return priceVnd > 150000;
    default:
      return true;
  }
}

function matchesSearch(
  spot: Spot,
  placeNameNormalized: string | null,
  term: string
): boolean {
  const normalizedTerm = normalizeVietnamese(term);
  if (!normalizedTerm) return true;
  const placeMatches = placeNameNormalized
    ? normalizeVietnamese(placeNameNormalized).startsWith(normalizedTerm)
    : false;
  const captionMatches = normalizeVietnamese(spot.caption || '').includes(normalizedTerm);
  return placeMatches || captionMatches;
}

/**
 * Kiểm tra một Spot có thỏa TẤT CẢ bộ lọc đang bật hay không.
 * Giá và đánh giá thuộc cùng một Spot; không suy ra từ Spot khác tại Place.
 */
export function matchesSpotFilters(
  spot: Spot,
  placeNameNormalized: string | null,
  filters: SpotFilters
): boolean {
  if (filters.category && spot.category !== filters.category) return false;

  if (filters.price !== 'any' && !matchesPrice(spot.priceVnd, filters.price)) {
    return false;
  }

  if (filters.minRating !== null) {
    if (spot.rating === null || spot.rating < filters.minRating) return false;
  }

  if (filters.searchTerm.trim() && !matchesSearch(spot, placeNameNormalized, filters.searchTerm)) {
    return false;
  }

  return true;
}

export function hasActiveFilters(filters: SpotFilters): boolean {
  return (
    filters.searchTerm.trim().length > 0 ||
    filters.category !== null ||
    filters.price !== 'any' ||
    filters.minRating !== null
  );
}
