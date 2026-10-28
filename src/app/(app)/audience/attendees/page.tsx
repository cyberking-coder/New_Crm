import { PhasePlaceholder } from "@/app/(app)/_placeholder";

export default function Page() {
  return (
    <PhasePlaceholder
      title={'Attendees'}
      description={'People who actually joined, with duration and device info.'}
      phase={3}
    />
  );
}
