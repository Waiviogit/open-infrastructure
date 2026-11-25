import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { respondToMcpGet } from '@opden-data-layer/clients';
import type { Request, Response } from 'express';
import {
  KNOWLEDGE_MCP_GET_GUIDE,
  KNOWLEDGE_MCP_PATH,
  KNOWLEDGE_MCP_PUBLIC_PATH,
} from '../constants/mcp';
import { McpService } from './mcp.service';

@Controller({ path: KNOWLEDGE_MCP_PATH })
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcp.handle(req, res);
  }

  @Get()
  describe(@Req() req: Request, @Res() res: Response): void {
    respondToMcpGet(
      req,
      res,
      KNOWLEDGE_MCP_GET_GUIDE,
      KNOWLEDGE_MCP_PUBLIC_PATH,
    );
  }
}
