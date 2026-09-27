"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ManagedUser, UserRole } from "@/lib/operations";
import { setManagedUserRoleAction } from "../actions";

const ROLES: UserRole[] = ["ADMIN", "OPERATOR", "VIEWER"];

export function UsersManager({
  users,
  currentUserId
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const [roles, setRoles] = useState<Record<string, UserRole>>(
    Object.fromEntries(users.map((user) => [user.id, user.role]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function saveRole(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setBusyId(userId);
    setMessage("");
    try {
      const result = await setManagedUserRoleAction(userId, roles[userId]);
      if ("error" in result) {
        setMessage(result.error ?? "Unable to update the role.");
        return;
      }
      setMessage("Role updated.");
      router.refresh();
    } catch {
      setMessage("Unable to confirm the role change. Refresh and check the current role.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-view" aria-label="Managed users">
      {message && (
        <p role="status" className="form-note">
          {message}
        </p>
      )}
      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Account</th>
              <th>Role</th>
              <th>Update role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName}</strong>
                </td>
                <td>{user.email}</td>
                <td>{user.active ? "Active" : "Inactive"}</td>
                <td>{user.role}</td>
                <td>
                  <form
                    onSubmit={(event) => void saveRole(event, user.id)}
                    className="toolbar-actions"
                  >
                    <label className="sr-only" htmlFor={`role-${user.id}`}>
                      Role for {user.displayName}
                    </label>
                    <select
                      id={`role-${user.id}`}
                      className="admin-input"
                      value={roles[user.id]}
                      disabled={!user.active || busyId !== null || user.id === currentUserId}
                      onChange={(event) =>
                        setRoles((current) => ({
                          ...current,
                          [user.id]: event.target.value as UserRole
                        }))
                      }
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="admin-btn admin-btn-small"
                      disabled={
                        !user.active ||
                        busyId !== null ||
                        roles[user.id] === user.role ||
                        user.id === currentUserId
                      }
                    >
                      {busyId === user.id ? "Saving…" : "Save"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="form-note">
        Role changes take effect on the next request. Your own administrator role cannot be changed
        here.
      </p>
    </section>
  );
}
