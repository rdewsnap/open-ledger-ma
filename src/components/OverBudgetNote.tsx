import { Link } from 'react-router';
import { formatMoney } from '../lib/format';
import type { Measure, TreeNode } from '../lib/types';

type Props = {
  tree: TreeNode | null;
  measure: Measure;
  partial: boolean;
};

/**
 * One sentence after the dek, for closed years where spending tops the budget, so
 * "Spent > Budgeted" does not read as the state breaking its budget.
 */
export function OverBudgetNote({ tree, measure, partial }: Props) {
  if (measure !== 'actual' || partial || !tree || tree.actual <= tree.enacted) return null;
  return (
    <>
      {' '}
      That is <span className="num text-ink">{formatMoney(tree.actual - tree.enacted)}</span> more
      than the <span className="num text-ink">{formatMoney(tree.enacted)}</span> budget. Most of
      the difference is spending allowed outside the budget, such as pension payments set by
      other laws. Some programs, like MassHealth, also spent more than their budget line, including
      any supplemental budgets recorded so far.{' '}
      <Link to="/methodology#why-spent-can-be-larger-than-budgeted">Why spending is higher</Link>
    </>
  );
}
