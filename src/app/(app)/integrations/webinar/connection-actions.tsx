"use client";

import { toggleWebinarConnectionAction, deleteWebinarConnectionAction } from "./actions";
import type { IntegrationConnectionRow } from "@/lib/integrations/connections";
import { Button } from "@/components/ui/button";

export function ConnectionActions({ connection }: { connection: IntegrationConnectionRow }) {
  const toggle = toggleWebinarConnectionAction.bind(null, connection.id, !connection.is_active);
  const remove = deleteWebinarConnectionAction.bind(null, connection.id);

  return (
    <div className="flex items-center gap-2">
      <form action={toggle}>
        <Button type="submit" variant="outline" size="sm">
          {connection.is_active ? "Pause" : "Resume"}
        </Button>
      </form>
      <form
        action={remove}
        onSubmit={(e) => {
          if (!confirm("Delete this connection? The webhook URL will stop working.")) {
            e.preventDefault();
          }
        }}
      >
        <Button type="submit" variant="destructive" size="sm">
          Delete
        </Button>
      </form>
    </div>
  );
}
