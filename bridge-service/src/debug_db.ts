
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const operationId = '4d7222e8-96f8-4573-9e6d-8d0c73db8b05';
    console.log(`Querying operation ${operationId}...`);

    const operation = await prisma.tacOperation.findUnique({
        where: { id: operationId }
    });

    if (!operation) {
        console.log('Operation not found');
        return;
    }

    console.log('Operation found:');
    console.log(JSON.stringify(operation, null, 2));

    if (operation.steps) {
        console.log('\nSteps details:');
        const steps = operation.steps as any[];
        steps.forEach((step, index) => {
            console.log(`Step ${index}: ${step.stepType}`);
            console.log('Metadata:', JSON.stringify(step.metadata, null, 2));
        });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
