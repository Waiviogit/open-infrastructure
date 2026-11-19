import { HubMarketTabBand } from '@/modules/business';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

/** Market band for the request's viewer: guests see the public catalog only. */
export async function HubMarketTabBandUser() {
  const user = await getRequestUser();
  return <HubMarketTabBand signedIn={user !== null} />;
}
