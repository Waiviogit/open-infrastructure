import { Injectable } from '@nestjs/common';
import { OblRepository } from '../../repositories/obl.repository';
import { normalizePair } from './obl.utils';

export interface OblOnBehalfPayerInput {
  /** Account that signed the transfer or the declare. */
  actor: string;
  /** Debtor whose debt to `receiver` is being paid. */
  onBehalfOf: string;
  receiver: string;
  eventSeq: bigint;
}

export interface OblOnBehalfPayer {
  /** Debtor: the payment row is recorded on the `payer`↔`receiver` ledger. */
  payer: string;
  /** Account that actually paid; null when the debtor paid itself. */
  paidBy: string | null;
}

/**
 * Decides whether a payment counts against the existing debtor↔receiver ledger.
 * Never creates a ledger or debt involving the actual payer.
 * @see docs/spec/obl/payments.md
 */
@Injectable()
export class OblOnBehalfPayerResolver {
  constructor(private readonly oblRepository: OblRepository) {}

  async resolve(input: OblOnBehalfPayerInput): Promise<OblOnBehalfPayer | null> {
    const actor = input.actor.trim();
    const payer = input.onBehalfOf.trim();
    const receiver = input.receiver.trim();
    if (actor === '' || payer === '' || receiver === '') {
      return null;
    }
    if (payer === receiver || actor === receiver) {
      return null;
    }

    const { pairLow, pairHigh } = normalizePair(payer, receiver);
    const startedSeq = await this.oblRepository.findLedgerStartedSeq(pairLow, pairHigh);
    if (startedSeq === null || input.eventSeq < startedSeq) {
      return null;
    }

    return { payer, paidBy: actor === payer ? null : actor };
  }
}
