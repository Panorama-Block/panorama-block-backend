-- One-time seed for bridge providers after Prisma migrations
INSERT INTO "TacBridgeProvider" ("id", "name", "displayName", "endpoint", "isActive", "supportedChains", "supportedTokens")
VALUES
  (gen_random_uuid(), 'tac', 'TAC Bridge', 'https://api.tac.build', true, '["ethereum","avalanche","base","optimism"]', '["USDT","USDC","ETH","AVAX"]')
ON CONFLICT DO NOTHING;
