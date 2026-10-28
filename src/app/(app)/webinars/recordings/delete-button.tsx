"use client";

import { deleteRecordingAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteRecordingButton({ recordingId }: { recordingId: string }) {
  const action = deleteRecordingAction.bind(null, recordingId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this recording?")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
        Delete
      </Button>
    </form>
  );
}
