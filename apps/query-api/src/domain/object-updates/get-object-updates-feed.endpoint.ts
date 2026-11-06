import { Injectable } from '@nestjs/common';
import { ObjectOwnership } from '@opden-data-layer/odl-db-types';

import type { VoterWaivPowerMap } from '@opden-data-layer/objects-domain';
import {
  computeApprovePercent,
  computeCuratorSet,
} from '@opden-data-layer/objects-domain';
import {
  ObjectOwnershipRepository,
  ObjectsCoreRepository,
  UpdatesFeedRepository,
} from '../../repositories';
import { GovernanceResolverService } from '../governance';
import {
  decodeUpdatesCursor,
  encodeUpdatesCursor,
  type UpdatesApprovalCursorPayload,
  type UpdatesRecencyCursorPayload,
} from './updates-cursor';
import { ObjectUpdateFeedItemsBuilder } from './object-update-feed-items.builder';
import type {
  ObjectUpdateFeedItemDto,
  ObjectUpdatesFeedQuery,
  ObjectUpdatesFeedResponseDto,
} from './schemas/object-updates-feed.schema';

export interface GetObjectUpdatesFeedInput {
  objectId: string;
  query: ObjectUpdatesFeedQuery;
  governanceObjectIdFromHeader?: string;
  viewerAccount?: string | undefined;
}

@Injectable()
export class GetObjectUpdatesFeedEndpoint {
  constructor(
    private readonly objectsCore: ObjectsCoreRepository,
    private readonly updatesFeedRepo: UpdatesFeedRepository,
    private readonly objectOwnershipRepo: ObjectOwnershipRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly itemsBuilder: ObjectUpdateFeedItemsBuilder,
  ) {}

  async execute(input: GetObjectUpdatesFeedInput): Promise<ObjectUpdatesFeedResponseDto | null> {
    const core = await this.objectsCore.findByObjectIdForPage(input.objectId);
    if (!core) {
      return null;
    }

    const governance = await this.governanceResolver.resolveMergedForObjectView(
      input.governanceObjectIdFromHeader,
    );
    const ownerships = await this.objectOwnershipRepo.findByObjectId(input.objectId);

    const filter = {
      updateType: input.query.update_type,
      locale: input.query.locale,
    };

    if (input.query.sort === 'recency') {
      return this.recencyPage(input, governance, ownerships, filter);
    }
    return this.approvalPage(input, governance, ownerships, filter);
  }

  async executeByUpdateId(input: {
    objectId: string;
    updateId: string;
    governanceObjectIdFromHeader?: string;
    viewerAccount?: string;
  }): Promise<ObjectUpdateFeedItemDto | null> {
    const core = await this.objectsCore.findByObjectIdForPage(input.objectId);
    if (!core) {
      return null;
    }

    const joinRow = await this.updatesFeedRepo.findJoinRowByObjectAndUpdateId(
      input.objectId,
      input.updateId,
    );
    if (!joinRow) {
      return null;
    }

    const governance = await this.governanceResolver.resolveMergedForObjectView(
      input.governanceObjectIdFromHeader,
    );
    const ownerships = await this.objectOwnershipRepo.findByObjectId(input.objectId);
    const items = await this.itemsBuilder.buildForObject(
      input.objectId,
      [joinRow],
      governance,
      ownerships,
      input.viewerAccount,
    );
    return items[0] ?? null;
  }

  private async recencyPage(
    input: GetObjectUpdatesFeedInput,
    governance: Parameters<typeof computeApprovePercent>[2],
    ownerships: ObjectOwnership[],
    filter: { updateType?: string; locale?: string },
  ): Promise<ObjectUpdatesFeedResponseDto> {
    const limit = input.query.limit;
    const rawDecoded = input.query.cursor ? decodeUpdatesCursor(input.query.cursor) : null;
    const decoded =
      rawDecoded?.kind === 'recency'
        ? rawDecoded
        : null;

    const rows = await this.updatesFeedRepo.findRecencyPage({
      objectId: input.objectId,
      ...filter,
      limit: limit + 1,
      cursorCreatedAt:
        decoded != null ? Number(decoded.created_at_unix) : undefined,
      cursorUpdateId: decoded?.update_id,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = await this.itemsBuilder.buildForObject(
      input.objectId,
      pageRows,
      governance,
      ownerships,
      input.viewerAccount,
    );

    let nextCursor: string | null = null;
    const last = pageRows[pageRows.length - 1];
    if (hasMore && last) {
      const createdAt = Number(last.row.created_at_unix);
      if (Number.isFinite(createdAt) && last.row.update_id.length > 0) {
        const payload: UpdatesRecencyCursorPayload = {
          kind: 'recency',
          created_at_unix: Math.trunc(createdAt),
          update_id: last.row.update_id,
        };
        nextCursor = encodeUpdatesCursor(payload);
      }
    }

    return {
      items,
      cursor: nextCursor,
      hasMore: nextCursor !== null ? hasMore : false,
    };
  }

  private async approvalPage(
    input: GetObjectUpdatesFeedInput,
    governance: Parameters<typeof computeApprovePercent>[2],
    ownerships: ObjectOwnership[],
    filter: { updateType?: string; locale?: string },
  ): Promise<ObjectUpdatesFeedResponseDto> {
    const limit = input.query.limit;
    const rawDecoded = input.query.cursor ? decodeUpdatesCursor(input.query.cursor) : null;
    let offset = 0;
    if (rawDecoded?.kind === 'approval') {
      offset = rawDecoded.offset;
    }

    const allRows = await this.updatesFeedRepo.findAllForApprovalSort({
      objectId: input.objectId,
      ...filter,
    });

    const updateIds = allRows.map((r) => r.row.update_id);
    const [votes, rankVoteProjection] = await Promise.all([
      this.updatesFeedRepo.findValidityVotesForObjectAndUpdates(
        input.objectId,
        updateIds,
      ),
      this.updatesFeedRepo.findRankVoteProjectionForUpdates(
        input.objectId,
        updateIds,
        input.viewerAccount,
      ),
    ]);
    const voterNames = [...new Set(votes.map((v) => v.voter))];
    const powersMap = await this.updatesFeedRepo.findWaivPowersByAccounts(voterNames);
    const voterWaivPowers: VoterWaivPowerMap = powersMap;

    const withPercent = allRows.map((jr) => ({
      jr,
      approve_percent: computeApprovePercent(jr.row, votes, governance, voterWaivPowers, ownerships),
    }));
    withPercent.sort((a, b) => {
      if (b.approve_percent !== a.approve_percent) {
        return b.approve_percent - a.approve_percent;
      }
      if (b.jr.row.created_at_unix !== a.jr.row.created_at_unix) {
        return b.jr.row.created_at_unix - a.jr.row.created_at_unix;
      }
      if (a.jr.row.update_id < b.jr.row.update_id) return 1;
      if (a.jr.row.update_id > b.jr.row.update_id) return -1;
      return 0;
    });

    const slice = withPercent.slice(offset, offset + limit + 1);
    const hasMore = slice.length > limit;
    const pageSlice = hasMore ? slice.slice(0, limit) : slice;

    const curatorSet = computeCuratorSet(ownerships, governance);
    const creatorAvatarUrls = await this.itemsBuilder.loadCreatorAvatarUrls(
      pageSlice.map((p) => p.jr),
    );
    const items: ObjectUpdateFeedItemDto[] = pageSlice.map((p) =>
      this.itemsBuilder.toDto(
        p.jr,
        p.approve_percent,
        votes,
        governance,
        ownerships,
        curatorSet,
        voterWaivPowers,
        input.viewerAccount,
        creatorAvatarUrls,
        rankVoteProjection,
      ),
    );

    const nextCursor =
      hasMore
        ? encodeUpdatesCursor({
            kind: 'approval',
            offset: offset + limit,
          } satisfies UpdatesApprovalCursorPayload)
        : null;

    return { items, cursor: nextCursor, hasMore };
  }
}
