/**
 * The other buildings the switcher lists. They are sample entries: fictional names, no data behind them,
 * and they do not open. The buildings that open are in data/mock/buildings. The list exists so the header
 * can show that the product is built for a portfolio larger than the buildings with data.
 *
 * Each entry carries the drawing of its icon: a tiny stacking plan of four floors, top floor first. A floor
 * is its suites' shares of the floor's width; `open` names the one suite drawn as available ([floor, suite]),
 * and `tone` is the colour of the leased suites. They make the buildings tell apart at a glance; they are
 * not data about them.
 */
export interface MiniStackDrawing {
  floors: ReadonlyArray<ReadonlyArray<number>>;
  open: readonly [number, number];
  tone: string;
}

export interface PortfolioEntry extends MiniStackDrawing {
  id: string;
  name: string;
  city: string;
}

/**
 * The live building's icon. It is a building's icon like the others, so it is not the Stax mark: its own
 * layout of suites and the Ascendix deep blue, never the mark's cyan and floors (portfolio.test.ts).
 */
export const LIVE_STACK: MiniStackDrawing = { floors: [[0.4, 0.6], [1], [0.6, 0.4], [0.5, 0.5]], open: [2, 1], tone: '#1a6fb0' };

export const PORTFOLIO: ReadonlyArray<PortfolioEntry> = [
  { id: 'P003', name: 'Galleria Commerce Plaza', city: 'Dallas, TX', floors: [[1], [1], [0.4, 0.6], [0.5, 0.5]], open: [2, 0], tone: '#14b8a6' },
  { id: 'P004', name: 'Trinity Riverfront Offices', city: 'Fort Worth, TX', floors: [[0.3, 0.7], [0.55, 0.45], [1], [1]], open: [1, 0], tone: '#8b5cf6' },
  { id: 'P006', name: 'Las Colinas Gateway', city: 'Irving, TX', floors: [[0.6, 0.4], [1], [0.35, 0.65], [1]], open: [2, 1], tone: '#10b981' },
  { id: 'P008', name: 'Frisco Crossroads Center', city: 'Frisco, TX', floors: [[0.4, 0.6], [1], [1], [0.3, 0.7]], open: [0, 0], tone: '#64748b' },
  { id: 'P009', name: 'Lakeside Commons at Grapevine', city: 'Grapevine, TX', floors: [[1], [0.7, 0.3], [1], [0.45, 0.55]], open: [1, 1], tone: '#0891b2' },
  { id: 'P010', name: 'Arlington Meridian Plaza', city: 'Arlington, TX', floors: [[0.55, 0.45], [1], [0.3, 0.7], [1]], open: [2, 0], tone: '#7c3aed' },
];
