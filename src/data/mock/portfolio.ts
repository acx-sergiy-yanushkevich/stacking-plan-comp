/**
 * The other buildings the switcher lists. They are sample entries: fictional names, no data behind them.
 * Only the live property (data/mock/property.ts) opens. The list exists so the header can show that the
 * product is built for a portfolio, not one building.
 */
export const PORTFOLIO: ReadonlyArray<{ id: string; name: string; city: string }> = [
  { id: 'P002', name: 'Legacy West Tower II', city: 'Plano, TX' },
  { id: 'P003', name: 'Galleria Commerce Plaza', city: 'Dallas, TX' },
  { id: 'P004', name: 'Trinity Riverfront Offices', city: 'Fort Worth, TX' },
  { id: 'P005', name: 'Cedar Springs Exchange', city: 'Dallas, TX' },
  { id: 'P006', name: 'Las Colinas Gateway', city: 'Irving, TX' },
];
