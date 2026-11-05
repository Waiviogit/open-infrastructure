import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  GOOGLE_MAPS_IDENTIFIER_TYPE,
  placeDetailsParamsSchema,
  PlacesRateLimitedError,
  placesSearchQuerySchema,
} from '../../domain/places';
import { catalogDescription } from '../mcp-tool-catalog';
import type { McpToolDeps } from '../mcp-tool.deps';
import {
  jsonToolResult,
  pickMcpContext,
  toolError,
  withMcpLocaleContext,
} from '../mcp-tool.helpers';

const RATE_LIMITED_MESSAGE = 'Too many place searches; retry in a minute';

export function registerPlacesTools(server: McpServer, deps: McpToolDeps): void {
  server.registerTool(
    'search_places',
    {
      description: catalogDescription('search_places'),
      inputSchema: withMcpLocaleContext(placesSearchQuerySchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      try {
        const result = await deps.placesSearch.execute({
          q: args.q,
          limit: args.limit,
          locale: ctx.locale,
          clientIp: deps.clientIp,
        });
        return jsonToolResult(result);
      } catch (error) {
        if (error instanceof PlacesRateLimitedError) {
          return toolError(RATE_LIMITED_MESSAGE);
        }
        throw error;
      }
    },
  );

  server.registerTool(
    'get_place_details',
    {
      description: catalogDescription('get_place_details'),
      inputSchema: withMcpLocaleContext(placeDetailsParamsSchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      try {
        const result = await deps.placeDetails.execute({
          placeId: args.place_id,
          locale: ctx.locale,
          clientIp: deps.clientIp,
        });
        return result ? jsonToolResult(result) : toolError(`Place not found: ${args.place_id}`);
      } catch (error) {
        if (error instanceof PlacesRateLimitedError) {
          return toolError(RATE_LIMITED_MESSAGE);
        }
        throw error;
      }
    },
  );

  server.registerTool(
    'get_place_object',
    {
      description: catalogDescription('get_place_object'),
      inputSchema: placeDetailsParamsSchema,
    },
    async (args) => {
      const result = await deps.objectByIdentifier.execute({
        type: GOOGLE_MAPS_IDENTIFIER_TYPE,
        value: args.place_id,
      });
      return result ? jsonToolResult(result) : toolError(`No object for place: ${args.place_id}`);
    },
  );
}
