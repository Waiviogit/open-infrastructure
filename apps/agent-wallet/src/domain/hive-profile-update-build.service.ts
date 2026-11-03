import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildAccountUpdate2ProfileOp,
  mergeHiveProfileMetadata,
  type HiveProfileField,
  type HiveProfilePatch,
  type HiveWireOperation,
} from '@opden-data-layer/hive-broadcast';

import type { AgentWalletConfig } from '../config/agent-wallet.config';
import { normalizeHiveAccount } from '../utils/hive-account';
import { HiveChainContextService } from './hive-chain-context.service';
import { LocalKeysService } from './local-keys.service';

export type BuildProfileUpdateInput = {
  account: string;
  profile: HiveProfilePatch;
};

export type ProfileUpdateBuildResult = {
  ops: HiveWireOperation[];
  opsCount: number;
  keyType: 'posting';
  signerAccount: string;
  canSignLocally: boolean;
  changedFields: HiveProfileField[];
  previousProfile: Record<string, unknown>;
  profile: Record<string, unknown>;
  warnings: string[];
};

@Injectable()
export class HiveProfileUpdateBuildService {
  constructor(
    private readonly config: ConfigService<AgentWalletConfig, true>,
    private readonly chainContext: HiveChainContextService,
    private readonly localKeys: LocalKeysService,
  ) {}

  async buildProfileUpdate(
    input: BuildProfileUpdateInput,
  ): Promise<ProfileUpdateBuildResult> {
    const account = normalizeHiveAccount(input.account);
    if (!account) {
      throw new Error('account is required');
    }
    if (Object.keys(input.profile).length === 0) {
      throw new Error('profile must contain at least one field');
    }

    const snapshot = await this.chainContext.getAccount(account);
    if (!snapshot) {
      throw new Error(`Hive account not found: ${account}`);
    }

    const merged = mergeHiveProfileMetadata({
      postingJsonMetadata: snapshot.posting_json_metadata,
      jsonMetadata: snapshot.json_metadata,
      patch: input.profile,
    });

    const warnings: string[] = [];
    const ops: HiveWireOperation[] = [];
    if (merged.changedFields.length === 0) {
      warnings.push(`Profile of @${account} already has these values — nothing to broadcast`);
    } else {
      ops.push(
        buildAccountUpdate2ProfileOp({
          account,
          postingJsonMetadata: merged.postingJsonMetadata,
        }),
      );
    }

    return {
      ops,
      opsCount: ops.length,
      keyType: 'posting',
      signerAccount: account,
      canSignLocally: this.resolveCanSignLocally(account, warnings),
      changedFields: merged.changedFields,
      previousProfile: merged.previousProfile,
      profile: merged.profile,
      warnings,
    };
  }

  private resolveCanSignLocally(account: string, warnings: string[]): boolean {
    if (!this.localKeys.hasAccount(account)) {
      warnings.push(
        `@${account} is not in the local key registry — broadcast via has_broadcast if the HAS session is @${account}, otherwise ops are payload only`,
      );
      return false;
    }
    if (!this.localKeys.getReadiness(account).postingReady) {
      warnings.push(`Posting key for @${account} is not configured — payload only`);
      return false;
    }
    if (this.config.get('signingMode', { infer: true }) === 'has') {
      warnings.push('HAS mode: broadcast via has_broadcast with keyType posting');
    }
    return true;
  }
}
