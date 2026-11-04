import { hiveBlockTimestampToDate } from '@opden-data-layer/core';
import { Injectable, Logger } from '@nestjs/common';
import { OblRepository } from '../../../repositories/obl.repository';
import type { OdlActionHandler, OdlEventContext } from '../../odl-shared';
import { paymentDeclarePayloadSchema } from '../obl-envelope.schema';
import { OblNotificationService } from '../obl-notification.service';
import { toUsdString, asJsonValue } from '../obl.utils';
import { OblOnBehalfPayerResolver } from '../obl-on-behalf-payer.resolver';

@Injectable()
export class PaymentDeclareHandler implements OdlActionHandler {
  readonly action = 'payment_declare';
  private readonly logger = new Logger(PaymentDeclareHandler.name);

  constructor(
    private readonly oblRepository: OblRepository,
    private readonly oblNotifications: OblNotificationService,
    private readonly onBehalfPayer: OblOnBehalfPayerResolver,
  ) {}

  async handle(payload: Record<string, unknown>, ctx: OdlEventContext): Promise<void> {
    const parsed = paymentDeclarePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn(`Invalid payment_declare payload: ${parsed.error.message}`);
      return;
    }
    const data = parsed.data;

    const existing = await this.oblRepository.findPayment(data.payment_id);
    if (existing) {
      this.logger.warn('payment_declare: payment already exists');
      return;
    }

    const attribution = await this.onBehalfPayer.resolve({
      actor: ctx.creator,
      onBehalfOf: data.payer,
      receiver: data.receiver,
      eventSeq: ctx.eventSeq,
    });
    if (!attribution) {
      this.logger.warn('payment_declare: rejected payer/receiver or no active ledger');
      return;
    }

    let amountUsd: string;
    try {
      amountUsd = toUsdString(data.amount_usd);
    } catch {
      this.logger.warn('payment_declare: invalid amount_usd');
      return;
    }

    await this.oblRepository.insertPayment({
      payment_id: data.payment_id,
      payer: attribution.payer,
      receiver: data.receiver,
      paid_by: attribution.paidBy,
      amount_usd: amountUsd,
      declared_amount_usd: amountUsd,
      method: 'offchain',
      token_symbol: null,
      token_amount: null,
      rate_usd: null,
      state: 'pending',
      ref: data.ref !== undefined ? asJsonValue(data.ref) : null,
      created_event_seq: ctx.eventSeq,
      transaction_id: ctx.transactionId,
      created_at: hiveBlockTimestampToDate(ctx.timestamp),
    });

    this.oblNotifications.emit(ctx, {
      type: 'obl_payment_declare',
      objectId: null,
      actor: attribution.paidBy ?? attribution.payer,
      payload: {
        paymentId: data.payment_id,
        payer: attribution.payer,
        receiver: data.receiver,
        amountUsd,
        state: 'pending',
        ...(attribution.paidBy ? { paidBy: attribution.paidBy } : {}),
      },
    });
  }
}
