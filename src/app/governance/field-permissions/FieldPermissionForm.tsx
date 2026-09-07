"use client";

import { useActionState } from "react";
import { createFieldPermissionAction, type FieldPermissionFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: FieldPermissionFormState = {};

const ACCESS_LEVEL_LABEL: Record<string, string> = {
  Hidden: "مخفي",
  ReadOnly: "عرض بس",
  ReadWrite: "عرض وتعديل",
};

export type RoleOption = { id: string; name: string };

export default function FieldPermissionForm({ roles }: { roles: RoleOption[] }) {
  const [state, formAction, pending] = useActionState(createFieldPermissionAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fp-role" className="text-xs">
          الدور *
        </Label>
        <Select name="roleId">
          <SelectTrigger id="fp-role" className="w-40">
            <SelectValue>{(value: string) => roles.find((r) => r.id === value)?.name ?? "اختار دور"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.roleId && <span className="text-xs text-destructive">{state.errors.roleId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fp-entity" className="text-xs">
          الكيان *
        </Label>
        <Input id="fp-entity" name="entityType" placeholder="DealScenario" className="w-40" />
        {state.errors?.entityType && <span className="text-xs text-destructive">{state.errors.entityType[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fp-field" className="text-xs">
          الحقل *
        </Label>
        <Input id="fp-field" name="fieldName" placeholder="walkAwayPrice" className="w-40" />
        {state.errors?.fieldName && <span className="text-xs text-destructive">{state.errors.fieldName[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fp-access" className="text-xs">
          مستوى الوصول *
        </Label>
        <Select name="accessLevel" defaultValue="Hidden">
          <SelectTrigger id="fp-access" className="w-32">
            <SelectValue>{(value: string) => ACCESS_LEVEL_LABEL[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACCESS_LEVEL_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ صلاحية حقل"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        الغياب (مفيش صف) = &quot;عرض وتعديل&quot; افتراضيًا لأي دور. اسم الكيان/الحقل لازم يطابق اسم الموديل/الحقل في قاعدة البيانات بالحرف (زي &quot;DealScenario&quot;/&quot;walkAwayPrice&quot;).
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
