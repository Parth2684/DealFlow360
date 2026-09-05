import "dotenv/config";
import { prisma } from "../src/client.js";
import { seedDemoOrganization } from "./seed.js";

const DEMO_ORG_ID = "dealflow360-demo";

async function main() {
  console.log("🔄 Resetting demo organization...");

  await prisma.organization.deleteMany({
    where: { id: DEMO_ORG_ID },
  });

  await seedDemoOrganization();
  console.log("✅ Demo reset complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
