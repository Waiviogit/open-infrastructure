import { BusinessPayOnBehalfClient } from '@/modules/business';
import { fetchOblBalance } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import {
  parsePayOnBehalfParams,
  validatePayOnBehalfParties,
} from '@/modules/business/domain/pay-on-behalf';

export default async function BusinessPayOnBehalfPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await requireBusinessUser();
  const parties = parsePayOnBehalfParams(await searchParams);
  const balance =
    validatePayOnBehalfParties(parties, username) === null
      ? await fetchOblBalance(parties.debtor, parties.receiver)
      : null;
  return (
    <BusinessPayOnBehalfClient
      username={username}
      initialParties={parties}
      initialBalance={balance ?? null}
    />
  );
}
