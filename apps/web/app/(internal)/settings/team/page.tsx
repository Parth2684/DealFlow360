import { requireAccess } from "../../../../features/shared/require-access";
import { TeamWorkspace } from "../../../../features/configuration/team-workspace";
export const metadata = { title: "Team Members" };
export default async function Page() {
  await requireAccess("configuration.manage");
  return <TeamWorkspace />;
}
