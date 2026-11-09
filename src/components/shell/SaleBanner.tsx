import type { Property } from '../../domain/types';
import { pct, usd0 } from '../../domain/format';
import { Chip, Icon } from '../ui';

export function SaleBanner({ property, leasable }: { property: Property; leasable: number }) {
  const s = property.saleListing;
  if (!s) return null;
  return (
    <div className="sp-sale sp-no-print" role="note">
      <Icon name="dollar" size={16} />
      <strong>Listed for sale</strong>
      <div className="sp-sale__facts">
        <span>{usd0(s.price)}</span>
        <span>{usd0(Math.round(s.price / leasable))}/RSF</span>
        {s.capRate !== null && <span>{pct(s.capRate)} cap</span>}
        <span>{s.broker}</span>
      </div>
      <Chip tone={s.status === 'Active' ? 'success' : 'warn'}>{s.status}</Chip>
    </div>
  );
}
