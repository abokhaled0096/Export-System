"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUserAction, type CreateUserFormState } from "./actions";

const initialState: CreateUserFormState = {};

export default function CreateUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-email" className="text-xs text-neutral-500">
          الإيميل
        </label>
        <input
          id="new-user-email"
          name="email"
          type="email"
          className="w-52 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.email && <span className="text-xs text-rose-600">{state.errors.email[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-fullName" className="text-xs text-neutral-500">
          الاسم الكامل
        </label>
        <input
          id="new-user-fullName"
          name="fullName"
          className="w-40 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.fullName && <span className="text-xs text-rose-600">{state.errors.fullName[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-roleId" className="text-xs text-neutral-500">
          الدور
        </label>
        <select
          id="new-user-roleId"
          name="roleId"
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-password" className="text-xs text-neutral-500">
          كلمة السر الابتدائية
        </label>
        <input
          id="new-user-password"
          name="password"
          type="text"
          className="w-40 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.password && <span className="text-xs text-rose-600">{state.errors.password[0]}</span>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
      >
        {pending ? "جاري الإضافة..." : "+ مستخدم جديد"}
      </button>
      {state.formError && (
        <span role="alert" className="w-full text-xs text-rose-600">
          {state.formError}
          {state.mfaRequired && (
            <>
              {" "}
              <Link href="/mfa/challenge?next=/admin/users" className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </span>
      )}
    </form>
  );
}
