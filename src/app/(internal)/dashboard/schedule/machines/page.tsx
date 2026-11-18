import { redirect } from "next/navigation";

// Machine schedules are the Schedule page now (11/18/26).
export default function MachineSchedulesRedirect() {
  redirect("/dashboard/schedule");
}
