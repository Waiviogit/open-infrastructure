import { AGENT_WALLET_MCP_INSTRUCTIONS } from './mcp-instructions';

describe('AGENT_WALLET_MCP_INSTRUCTIONS', () => {
  it('leads with local env-key workflow before HAS', () => {
    const localIndex = AGENT_WALLET_MCP_INSTRUCTIONS.indexOf('Workflow (local keys');
    const hasIndex = AGENT_WALLET_MCP_INSTRUCTIONS.indexOf('Workflow (HAS signing');
    expect(localIndex).toBeGreaterThanOrEqual(0);
    expect(hasIndex).toBeGreaterThan(localIndex);
  });

  it('documents accounts.json and wallet_accounts', () => {
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('accounts.json');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('wallet_accounts');
  });

  it('documents posting authority act-as and grant builder', () => {
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('get_user_authority_grantors');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('hive_build_posting_authority_grant');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('canSignLocally');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('has_broadcast with keyType active');
  });

  it('routes new Hive accounts with a VIP ticket through OBL before public providers', () => {
    const oblIndex = AGENT_WALLET_MCP_INSTRUCTIONS.indexOf('search_obl_offers');
    const fallbackIndex = AGENT_WALLET_MCP_INSTRUCTIONS.indexOf('hive-account-signup');
    expect(oblIndex).toBeGreaterThanOrEqual(0);
    expect(fallbackIndex).toBeGreaterThan(oblIndex);
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('get_obl_offer');
  });

  it('maps delete requests to update_vote against (values) and status (objects)', () => {
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('odl_build_update_vote');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('vote: "against"');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('updateType: "status"');
  });

  it('documents object activity fingerprint and obj-ch channel ids', () => {
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('osl_activity_fingerprint');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('check_object_activity_duplicate');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('obj-ch-{objectId}');
  });

  it('routes comment drafts for humans to the import link, never to auto-post', () => {
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain('activity_note_import_link');
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain(
      'Never osl_build_message_create for drafts and never auto-post',
    );
    expect(AGENT_WALLET_MCP_INSTRUCTIONS).toContain(
      "never ask for or use the human's token or login",
    );
  });
});
