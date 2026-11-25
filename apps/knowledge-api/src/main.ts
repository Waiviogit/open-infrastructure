import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { KnowledgeReindexBootstrapService } from './bootstrap/knowledge-reindex-bootstrap.service';
import { SkillsRefreshService } from './bootstrap/skills-refresh.service';
import { KNOWLEDGE_GLOBAL_PREFIX, configureHttp } from './configure-http';
import { KNOWLEDGE_MCP_PUBLIC_PATH } from './constants/mcp';
import { MainModule } from './main.module';

async function bootstrap() {
  const app = await NestFactory.create(MainModule);
  configureHttp(app);

  const reindexBootstrap = app.get(KnowledgeReindexBootstrapService);
  const skillsRefresh = app.get(SkillsRefreshService);
  await reindexBootstrap.runBeforeListen();

  const port = process.env.PORT || 7400;
  await app.listen(port);
  reindexBootstrap.runAfterListen();
  skillsRefresh.startAfterListen();
  Logger.log(
    `Application is running on: http://localhost:${port}/${KNOWLEDGE_GLOBAL_PREFIX}`,
  );
  Logger.log(
    `MCP endpoint: http://localhost:${port}${KNOWLEDGE_MCP_PUBLIC_PATH}`,
  );
}

bootstrap();
