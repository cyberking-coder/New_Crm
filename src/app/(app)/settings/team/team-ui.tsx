"use client";

import { useActionState, useId, useTransition } from "react";
import {
  inviteMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
  revokeInvitationAction,
  type ActionState,
} from "./actions";
import type { OrgRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function InviteForm() {
  const idp = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    inviteMemberAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor={`${idp}-email`}>Email</Label>
        <Input
          id={`${idp}-email`}
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
        />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idp}-role`}>Role</Label>
        <Select id={`${idp}-role`} name="role" defaultValue="member">
          <option value="member">Member</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Invite"}
      </Button>
      {state?.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p className="w-full text-sm text-emerald-600">{state.ok}</p>
      ) : null}
    </form>
  );
}

const ROLE_OPTIONS: OrgRole[] = ["member", "manager", "admin", "owner"];

export function MemberActions({
  userId,
  role,
  isSelf,
  viewerIsOwner,
}: {
  userId: string;
  role: OrgRole;
  isSelf: boolean;
  viewerIsOwner: boolean;
}) {
  const [pending, start] = useTransition();

  const onRoleChange = (next: OrgRole) => {
    if (next === role) return;
    start(async () => {
      await changeMemberRoleAction(userId, next);
    });
  };

  const remove = removeMemberAction.bind(null, userId);

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        value={role}
        onChange={(e) => onRoleChange(e.target.value as OrgRole)}
        disabled={pending || (role === "owner" && !viewerIsOwner)}
        className="w-28"
      >
        {ROLE_OPTIONS.filter((r) => r !== "owner" || viewerIsOwner).map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <form
        action={remove}
        onSubmit={(e) => {
          if (isSelf || !confirm("Remove this member from the organization?")) e.preventDefault();
        }}
      >
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={isSelf}
          title={isSelf ? "You can't remove yourself here." : undefined}
        >
          Remove
        </Button>
      </form>
    </div>
  );
}

export function InvitationActions({
  invitationId,
  link,
}: {
  invitationId: string;
  link: string;
}) {
  const revoke = revokeInvitationAction.bind(null, invitationId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        Copy link
      </Button>
      <form
        action={revoke}
        onSubmit={(e) => {
          if (!confirm("Revoke this invitation?")) e.preventDefault();
        }}
      >
        <Button type="submit" size="sm" variant="ghost" className="text-destructive">
          Revoke
        </Button>
      </form>
    </div>
  );
}
