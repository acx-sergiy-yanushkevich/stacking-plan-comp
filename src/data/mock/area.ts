import type { Area } from '../../domain/types';

/**
 * Demographics for the demo property. These are SAMPLE figures so the prototype renders
 * offline and screenshots stay reproducible. Live mode (?live=1&census=KEY) replaces them
 * with US Census Bureau ACS 5-year data aggregated over the tracts within each ring.
 */
export const area: Area = {
  source: 'Sample figures for the demo. Live mode uses US Census Bureau ACS 5-year (api.census.gov, free key) and OpenStreetMap.',
  asOf: '2024',
  sample: true,
  rings: [
    { miles: 1, population: 14820, households: 6410, medianIncome: 98400, medianAge: 36.8, bachelorsPct: 0.61, meanCommuteMin: 24.1 },
    { miles: 3, population: 118600, households: 47900, medianIncome: 104900, medianAge: 37.9, bachelorsPct: 0.63, meanCommuteMin: 25.6 },
    { miles: 5, population: 329400, households: 128700, medianIncome: 101200, medianAge: 37.2, bachelorsPct: 0.59, meanCommuteMin: 26.3 },
  ],
  transit: [
    { name: 'Parker Road Station (DART Red/Orange)', type: 'Rail', distanceMi: 3.1 },
    { name: 'Preston Rd @ Park Blvd', type: 'Bus', distanceMi: 0.2 },
    { name: 'Park Blvd @ Preston Park Blvd', type: 'Bus', distanceMi: 0.3 },
    { name: 'Downtown Plano Station (DART)', type: 'Rail', distanceMi: 4.6 },
  ],
  amenities: [
    { category: 'Restaurants', count: 42 },
    { category: 'Cafés', count: 9 },
    { category: 'Hotels', count: 4 },
    { category: 'Fitness', count: 6 },
    { category: 'Banks', count: 7 },
    { category: 'Parking', count: 11 },
  ],
};
