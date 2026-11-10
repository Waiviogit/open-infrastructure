import { KNOWLEDGE_MCP_INSTRUCTIONS } from './mcp-instructions';

describe('KNOWLEDGE_MCP_INSTRUCTIONS', () => {
  it('orders solution search: OBL offers, then ODL service offers, then the web', () => {
    const oblIndex = KNOWLEDGE_MCP_INSTRUCTIONS.indexOf('search_obl_offers');
    const odlIndex = KNOWLEDGE_MCP_INSTRUCTIONS.indexOf('object_type: "service_offer"');
    const webIndex = KNOWLEDGE_MCP_INSTRUCTIONS.indexOf('open web');
    expect(oblIndex).toBeGreaterThanOrEqual(0);
    expect(odlIndex).toBeGreaterThan(oblIndex);
    expect(webIndex).toBeGreaterThan(odlIndex);
  });

  it('keeps user-supplied tickets on the issuing OBL offer', () => {
    expect(KNOWLEDGE_MCP_INSTRUCTIONS).toContain('VIP ticket');
    expect(KNOWLEDGE_MCP_INSTRUCTIONS).toContain('OBL offer that issued it');
  });
});
