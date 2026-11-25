import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { respondToMcpGet } from '@opden-data-layer/clients';
import type { Request, Response } from 'express';
import {
  QUERY_MCP_GET_GUIDE,
  QUERY_MCP_PATH,
  QUERY_MCP_PUBLIC_PATH,
} from '../constants/mcp.constants';
import { McpService } from './mcp.service';

@Controller({ path: QUERY_MCP_PATH, version: VERSION_NEUTRAL })
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcp.handle(req, res);
  }

  @Get()
  describe(@Req() req: Request, @Res() res: Response): void {
    respondToMcpGet(req, res, QUERY_MCP_GET_GUIDE, QUERY_MCP_PUBLIC_PATH);
  }
}
