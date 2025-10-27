import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenantId = process.env.SEED_TENANT_ID ?? 'tenant-demo';

const main = async (): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { userId: 'user-demo' },
      update: {},
      create: {
        userId: 'user-demo',
        displayName: 'Demo User',
        tenantId,
        attributes: { plan: 'gold' }
      }
    });

    const conversation = await tx.conversation.upsert({
      where: { id: 'conv-demo' },
      update: {},
      create: {
        id: 'conv-demo',
        userId: 'user-demo',
        conversationId: 'conv-001',
        title: 'Welcome conversation',
        tenantId
      }
    });

    await tx.message.upsert({
      where: { messageId: 'msg-demo' },
      update: {},
      create: {
        messageId: 'msg-demo',
        userId: 'user-demo',
        conversationId: conversation.conversationId,
        role: 'system',
        content: 'Seeded hello world message',
        tenantId
      }
    });
  });
};

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
