import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentJwtUser,
  JwtAccessGuard,
  normalizeHiveAccount,
  type JwtAccessUser,
} from '../auth';
import {
  ActivityMessageNotFoundError,
  ActivityNoteNotFoundError,
  ActivityNotesLimitReachedError,
  ActivityNotesService,
  activityNoteBodySchema,
  activityNoteParamsSchema,
  activityNotesMessageParamsSchema,
  type ActivityNoteBody,
  type ActivityNoteListResponse,
  type ActivityNoteParams,
  type ActivityNotesMessageParams,
  type ActivityNoteView,
} from '../domain/activity-notes';
import { ZodBodyPipe, ZodQueryPipe } from '../pipes';

function rethrowActivityNotesError(error: unknown): never {
  if (error instanceof ActivityMessageNotFoundError) {
    throw new NotFoundException({
      message: 'Activity message not found',
      code: 'activity_message_not_found',
    });
  }
  if (error instanceof ActivityNoteNotFoundError) {
    throw new NotFoundException({
      message: 'Note not found',
      code: 'activity_note_not_found',
    });
  }
  if (error instanceof ActivityNotesLimitReachedError) {
    throw new ConflictException({
      message: `Notes limit reached (${error.limit} per message)`,
      code: 'activity_notes_limit_reached',
    });
  }
  throw error;
}

/** Private notes on an activity message; visible only to the JWT subject. */
@Controller({ path: 'messages/:messageId/notes', version: '1' })
@UseGuards(JwtAccessGuard)
export class ActivityMessageNotesController {
  constructor(private readonly notes: ActivityNotesService) {}

  @Get()
  async list(
    @CurrentJwtUser() user: JwtAccessUser,
    @Param(new ZodQueryPipe(activityNotesMessageParamsSchema))
    params: ActivityNotesMessageParams,
  ): Promise<ActivityNoteListResponse> {
    return this.notes.list(normalizeHiveAccount(user.sub), params.messageId);
  }

  @Post()
  async create(
    @CurrentJwtUser() user: JwtAccessUser,
    @Param(new ZodQueryPipe(activityNotesMessageParamsSchema))
    params: ActivityNotesMessageParams,
    @Body(new ZodBodyPipe(activityNoteBodySchema)) body: ActivityNoteBody,
  ): Promise<ActivityNoteView> {
    try {
      return await this.notes.create(
        normalizeHiveAccount(user.sub),
        params.messageId,
        body.body,
      );
    } catch (error) {
      rethrowActivityNotesError(error);
    }
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAll(
    @CurrentJwtUser() user: JwtAccessUser,
    @Param(new ZodQueryPipe(activityNotesMessageParamsSchema))
    params: ActivityNotesMessageParams,
  ): Promise<void> {
    await this.notes.deleteAll(
      normalizeHiveAccount(user.sub),
      params.messageId,
    );
  }

  @Patch(':noteId')
  async update(
    @CurrentJwtUser() user: JwtAccessUser,
    @Param(new ZodQueryPipe(activityNoteParamsSchema))
    params: ActivityNoteParams,
    @Body(new ZodBodyPipe(activityNoteBodySchema)) body: ActivityNoteBody,
  ): Promise<ActivityNoteView> {
    try {
      return await this.notes.update(
        normalizeHiveAccount(user.sub),
        params.messageId,
        params.noteId,
        body.body,
      );
    } catch (error) {
      rethrowActivityNotesError(error);
    }
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentJwtUser() user: JwtAccessUser,
    @Param(new ZodQueryPipe(activityNoteParamsSchema))
    params: ActivityNoteParams,
  ): Promise<void> {
    try {
      await this.notes.delete(
        normalizeHiveAccount(user.sub),
        params.messageId,
        params.noteId,
      );
    } catch (error) {
      rethrowActivityNotesError(error);
    }
  }
}
