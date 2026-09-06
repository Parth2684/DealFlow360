"use client";
import {
  TeamMemberCreateSchema,
  TeamMemberDtoSchema,
  TeamMemberUpdateSchema,
  apiRoutes,
  createCursorPageSchema,
  formatEnumLabel,
} from "@repo/common";
import {
  Badge,
  Button,
  ErrorFeedback,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  Panel,
  PanelBody,
  Select,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { z } from "zod";
import { browserApiRequest } from "../../lib/api/browser";

export function TeamWorkspace() {
  const [selected, setSelected] =
    useState<z.infer<typeof TeamMemberDtoSchema>>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["team", cursors.at(-1)],
    queryFn: ({ signal }) =>
      browserApiRequest(
        `${apiRoutes.team.list}?limit=25${cursors.at(-1) ? `&cursor=${cursors.at(-1)}` : ""}`,
        { schema: createCursorPageSchema(TeamMemberDtoSchema), signal },
      ),
  });
  return (
    <div className="grid gap-lg">
      <PageHeader
        title="Team Members"
        description="Give sales, finance, and operations colleagues access to this organization."
        actions={
          <Button
            onClick={() => {
              setSelected(undefined);
              setOpen(true);
            }}
          >
            Add Team Member
          </Button>
        }
      />
      {error || query.isError ? (
        <ErrorFeedback title="Team update needs attention">
          {error || query.error?.message}
        </ErrorFeedback>
      ) : null}
      <Panel>
        <PanelBody>
          <div className="grid gap-md">
            {query.data?.items.map((member) => (
              <article
                className="flex flex-wrap justify-between gap-sm border-b border-border pb-sm"
                key={member.id}
              >
                <div>
                  <strong>
                    {member.firstName} {member.lastName}
                  </strong>
                  <p>
                    {member.email} ·{" "}
                    {member.roles.map(formatEnumLabel).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-sm">
                  <Badge>{formatEnumLabel(member.status)}</Badge>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setSelected(member);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </PanelBody>
      </Panel>
      <div className="flex justify-between">
        <Button
          disabled={!cursors.length}
          variant="secondary"
          onClick={() => setCursors((items) => items.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          disabled={!query.data?.pageInfo.hasNextPage}
          variant="secondary"
          onClick={() => {
            const next = query.data?.pageInfo.nextCursor;
            if (next) setCursors((items) => [...items, next]);
          }}
        >
          Next
        </Button>
      </div>
      {open ? (
        <Panel>
          <PanelBody>
            <form
              key={selected?.id ?? "new"}
              className="grid gap-sm"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const values = {
                    firstName: form.get("firstName"),
                    lastName: form.get("lastName"),
                    password: String(form.get("password") ?? "") || undefined,
                    roles: form.getAll("roles"),
                  };
                  const body = selected
                    ? TeamMemberUpdateSchema.parse({
                        ...values,
                        revision: selected.revision,
                        status: form.get("status"),
                      })
                    : TeamMemberCreateSchema.parse({
                        ...values,
                        email: form.get("email"),
                      });
                  await browserApiRequest(
                    selected
                      ? apiRoutes.team.member(selected.id)
                      : apiRoutes.team.list,
                    {
                      method: selected ? "PATCH" : "POST",
                      json: body,
                      schema: TeamMemberDtoSchema,
                    },
                  );
                  setOpen(false);
                  await query.refetch();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Unable to save team member",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>{selected ? "Edit Team Member" : "Add Team Member"}</h2>
              <Field>
                <FieldLabel htmlFor="member-first">First name</FieldLabel>
                <Input
                  id="member-first"
                  name="firstName"
                  defaultValue={selected?.firstName}
                  required
                  maxLength={100}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="member-last">Last name</FieldLabel>
                <Input
                  id="member-last"
                  name="lastName"
                  defaultValue={selected?.lastName}
                  required
                  maxLength={100}
                />
              </Field>
              {!selected ? (
                <Field>
                  <FieldLabel htmlFor="member-email">Work email</FieldLabel>
                  <Input id="member-email" name="email" type="email" required />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="member-password">
                  {selected
                    ? "New password (leave blank to keep current)"
                    : "Initial password"}
                </FieldLabel>
                <Input
                  id="member-password"
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required={!selected}
                />
              </Field>
              <fieldset className="grid gap-xs">
                <legend>Roles</legend>
                {[
                  "ADMIN",
                  "SALES_REP",
                  "SALES_MANAGER",
                  "FINANCE",
                  "OPERATIONS",
                ].map((role) => (
                  <label key={role} className="flex gap-xs">
                    <input
                      type="checkbox"
                      name="roles"
                      value={role}
                      defaultChecked={
                        selected
                          ? selected.roles.some((item) => item === role)
                          : role === "SALES_REP"
                      }
                    />
                    {formatEnumLabel(role)}
                  </label>
                ))}
              </fieldset>
              {selected ? (
                <Field>
                  <FieldLabel htmlFor="member-status">Access</FieldLabel>
                  <Select
                    id="member-status"
                    name="status"
                    defaultValue={selected.status}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DISABLED">Disabled</option>
                  </Select>
                </Field>
              ) : (
                <p>
                  Share the initial password with your colleague through your
                  usual secure channel.
                </p>
              )}
              <div className="flex gap-sm">
                <Button type="submit" disabled={busy}>
                  Save Team Member
                </Button>
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
