import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObjectOwnership, ValidityVote } from '@opden-data-layer/odl-db-types';

import type { GovernanceSnapshot, VoterWaivPowerMap } from '@opden-data-layer/objects-domain';
import {
  computeApprovePercent,
  computeCuratorSet,
  resolveUpdateValidity,
} from '@opden-data-layer/objects-domain';
import { AccountsCurrentRepository, UpdatesFeedRepository } from '../../repositories';
import type { UpdatesFeedJoinRow } from '../../repositories/updates-feed.repository';
import { feedItemImagePreviewUrls } from '../object-projection/image-display-url';
import { loadAccountAvatarUrls } from '../users/load-account-avatar-urls';
import {
  previewValidityVoters,
  resolveLatestValidityVoters,
} from './resolve-latest-validity-votes';
import type {
  DecisivePrivilegedVoteDto,
  ObjectUpdateFeedItemDto,
} from './schemas/object-updates-feed.schema';
import type { RankVoteProjection } from '../object-projection/projected-object.types';
import { emptyRankVoteProjection } from '../object-projection/projected-object.types';

/**
 * Builds `ObjectUpdateFeedItemDto` rows (approval %, validity votes, rank, creator avatar)
 * for one object. Shared by the per-object updates feed and the followed-objects updates feed.
 */
@Injectable()
export class ObjectUpdateFeedItemsBuilder {
  constructor(
    private readonly updatesFeedRepo: UpdatesFeedRepository,
    private readonly config: ConfigService,
    private readonly accounts: AccountsCurrentRepository,
  ) {}

  async buildForObject(
    objectId: string,
    pageRows: readonly UpdatesFeedJoinRow[],
    governance: GovernanceSnapshot,
    ownerships: ObjectOwnership[],
    viewerAccount: string | undefined,
  ): Promise<ObjectUpdateFeedItemDto[]> {
    const updateIds = pageRows.map((r) => r.row.update_id);
    if (updateIds.length === 0) {
      return [];
    }
    const [votes, rankVoteProjection, creatorAvatarUrls] = await Promise.all([
      this.updatesFeedRepo.findValidityVotesForObjectAndUpdates(objectId, updateIds),
      this.updatesFeedRepo.findRankVoteProjectionForUpdates(
        objectId,
        updateIds,
        viewerAccount,
      ),
      this.loadCreatorAvatarUrls(pageRows),
    ]);
    const voterNames = [...new Set(votes.map((v) => v.voter))];
    const voterWaivPowers: VoterWaivPowerMap =
      await this.updatesFeedRepo.findWaivPowersByAccounts(voterNames);
    const curatorSet = computeCuratorSet(ownerships, governance);

    return pageRows.map((jr) =>
      this.toDto(
        jr,
        computeApprovePercent(jr.row, votes, governance, voterWaivPowers, ownerships),
        votes,
        governance,
        ownerships,
        curatorSet,
        voterWaivPowers,
        viewerAccount,
        creatorAvatarUrls,
        rankVoteProjection,
      ),
    );
  }

  loadCreatorAvatarUrls(
    joinRows: ReadonlyArray<{ row: { creator: string } }>,
  ): Promise<Map<string, string | null>> {
    return loadAccountAvatarUrls(
      this.accounts,
      joinRows.map((jr) => jr.row.creator),
    );
  }

  toDto(
    jr: {
      row: Parameters<typeof computeApprovePercent>[0];
      creator_wobjects_weight: number;
      geo_lat: number | null;
      geo_lon: number | null;
    },
    approvePercent: number,
    allVotes: ValidityVote[],
    governance: GovernanceSnapshot,
    ownerships: ObjectOwnership[],
    curatorSet: Set<string>,
    voterWaivPowers: VoterWaivPowerMap,
    viewerAccount: string | undefined,
    creatorAvatarUrls: ReadonlyMap<string, string | null>,
    rankVoteProjection: RankVoteProjection = emptyRankVoteProjection(),
  ): ObjectUpdateFeedItemDto {
    const updateVotes = allVotes.filter((v) => v.update_id === jr.row.update_id);
    let forC = 0;
    let againstC = 0;
    for (const v of updateVotes) {
      if (v.vote === 'for') forC += 1;
      else againstC += 1;
    }

    const viewer = viewerAccount?.trim();
    let viewerVote: 'for' | 'against' | null = null;
    if (viewer && viewer.length > 0) {
      const mine = updateVotes.filter((v) => v.voter === viewer);
      if (mine.length > 0) {
        const latest = mine.reduce((best, v) => (v.event_seq > best.event_seq ? v : best));
        viewerVote = latest.vote;
      }
    }

    const value_geo =
      jr.geo_lat != null &&
      jr.geo_lon != null &&
      Number.isFinite(jr.geo_lat) &&
      Number.isFinite(jr.geo_lon)
        ? { latitude: jr.geo_lat, longitude: jr.geo_lon }
        : null;

    const gateway =
      this.config.get<string | undefined>('ipfs.contentBaseUrl');
    const image_preview_urls = feedItemImagePreviewUrls(
      jr.row.update_type,
      jr.row.value_text,
      jr.row.value_json ?? null,
      gateway,
    );

    const validity = resolveUpdateValidity(
      jr.row,
      allVotes,
      curatorSet,
      governance,
      voterWaivPowers,
      ownerships,
    );
    const decisive_privileged_vote = this.mapDecisivePrivilegedVote(validity);
    const { forVoters, againstVoters } = resolveLatestValidityVoters(updateVotes);

    return {
      update_id: jr.row.update_id,
      object_id: jr.row.object_id,
      update_type: jr.row.update_type,
      creator: jr.row.creator,
      creator_avatar_url: creatorAvatarUrls.get(jr.row.creator.trim()) ?? null,
      creator_wobjects_weight: jr.creator_wobjects_weight,
      locale: jr.row.locale,
      created_at_unix: jr.row.created_at_unix,
      transaction_id: jr.row.transaction_id,
      value_text: jr.row.value_text,
      value_geo,
      value_json: jr.row.value_json ?? null,
      image_preview_urls,
      approve_percent: approvePercent,
      for_vote_count: forC,
      against_vote_count: againstC,
      for_preview_voters: previewValidityVoters(forVoters.map((entry) => entry.voter)),
      against_preview_voters: previewValidityVoters(againstVoters.map((entry) => entry.voter)),
      viewer_vote: viewerVote,
      decisive_privileged_vote,
      rank_score: this.coerceRankScore(jr.row.rank_score),
      viewer_rank: this.resolveViewerRank(jr.row.update_id, viewerAccount, rankVoteProjection),
    };
  }

  private coerceRankScore(raw: unknown): number | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'bigint') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const n = Number(raw.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private resolveViewerRank(
    updateId: string,
    viewerAccount: string | undefined,
    rankVoteProjection: RankVoteProjection,
  ): number | null {
    if (!viewerAccount?.trim()) {
      return null;
    }
    const raw = rankVoteProjection.viewerRankByUpdateId.get(updateId);
    return raw != null && typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }

  private mapDecisivePrivilegedVote(
    validity: ReturnType<typeof resolveUpdateValidity>,
  ): DecisivePrivilegedVoteDto | null {
    if (
      (validity.validity_tier === 'admin' || validity.validity_tier === 'trusted') &&
      validity.decisive_voter != null &&
      validity.decisive_vote != null
    ) {
      return {
        tier: validity.validity_tier,
        vote: validity.decisive_vote,
        voter: validity.decisive_voter,
      };
    }
    return null;
  }
}
