"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useFormDialogClose } from "@/components/FormDialog";

/**
 * `<Form>` — بديل `<form action={formAction}>` بيحافظ على اللي المستخدم كتبه لما الحفظ يفشل.
 *
 * ## المشكلة
 *
 * React 19 بيعمل `form.reset()` **تلقائيًا** بعد ما أي `<form action={fn}>` يخلّص — سواء
 * نجح أو فشل. يعني المستخدم يملا فورم فيه ١٢ حقل، ينسى حقل واحد مطلوب، يدوس حفظ، فيرجع
 * له الفورم **فاضي بالكامل** ومعاه رسالة «الحقل الفلاني مطلوب».
 *
 * اتكشف بتجربة فورم هدف المبيعات (1 أكتوبر): كتبت الفترة والتاريخين والقيمة، القيمة كانت
 * 0، رجعت رسالة «القيمة المستهدفة مطلوبة» و**التلات حقول التانية اتمسحوا كلهم**. الحقول
 * المتحكَّم فيها (`useState`) بتنجو من المسح، والعادية لأ — وده كان بيخفي العيب، لأن
 * الفورمات اللي فيها حقول متحكَّم فيها كان شكلها سليم.
 *
 * كان بيأثّر على **١٤٩ فورم**. في نظام إدخال بيانات، ده أكتر عيب بيخلّي المستخدم يكره الشاشة.
 *
 * ## ليه الحل مش "نلغي الـreset التلقائي"
 *
 * الطريقة الواضحة إن الـaction تتنادى من `onSubmit` جوه `startTransition` بدل ما تتبعت
 * لـ`action` — ساعتها React مابيعملش reset أصلًا. **جرّبتها وكسرت حاجة أهم**: لما الـaction
 * بتتبعت لـ`action` على العنصر، Next بيطبّق نتيجة `revalidatePath` على الصفحة المفتوحة
 * فورًا؛ ولما بتتنادى يدويًا، الحفظ بينجح بس الشاشة بتفضل بايتة لحد ما المستخدم يعمل
 * refresh. (اتقاس بمقارنة A/B على نفس الفورم: القديم أظهر «2 هدف مسجّل» فورًا، الجديد فضل
 * «1».) إصلاح إزعاج مقابل إدخال عيب أسوأ — مش مقايضة.
 *
 * ## الحل الفعلي
 *
 * بنسيب `action={formAction}` زي ما هي (كل سلوك Next يفضل مطابق)، وبناخد **نسخة** من
 * `FormData` وقت الإرسال، وبنرجّعها للحقول في `useEffect` **لو بس** الـaction رجعت فشل.
 * الـeffect بيشتغل بعد الـcommit اللي فيه الـreset، فالاسترجاع بييجي بعده.
 *
 * "فشل" = الحالة الراجعة فيها `formError` أو `errors`، وهو الشكل الموحَّد لكل
 * `*FormState` في المشروع. عند النجاح مابنعملش حاجة — الفورم بيتفضّى زي الأول بالظبط.
 */

type ActionFormState = { errors?: unknown; formError?: unknown } | null | undefined;

/** الحقول اللي مالهاش لازمة في الاسترجاع — أو اللي استرجاعها غلط أمنيًا. */
function isRestorable(el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  // ⚠️ مابنرجّعش كلمات السر ولا الملفات: الأولى مايصحّش تتخزّن في الذاكرة أكتر من اللازم،
  // والتانية `value` بتاعها للقراءة بس (المتصفح بيمنع الكتابة لأسباب أمنية).
  return el.type !== "password" && el.type !== "file" && el.type !== "submit" && el.type !== "button";
}

export function Form({
  action,
  state,
  preserveOnError = true,
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  /** الـ`formAction` الراجعة من `useActionState`. */
  action: string | ((formData: FormData) => void);
  /** الحالة الراجعة من `useActionState` — منها بنعرف فشل ولا لأ. */
  state: ActionFormState;
  /** `false` لفورم مايصحّش يفضل محتفظ بقيمه بعد الفشل. */
  preserveOnError?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  const closeDialog = useFormDialogClose();

  useEffect(() => {
    const snapshot = submitted.current;
    if (!snapshot) return;
    submitted.current = null;
    const failed = Boolean(state?.formError) || Boolean(state?.errors);
    // ⚠️ الفورم هو اللي يعرف إنه نجح، فهو اللي بيقفل النافذة. قبل كده كل فورم كان لازم
    // يضيف `ok: true` في الـaction بتاعته و`useEffect` خاص بيها عشان تقفل — يعني تعديل
    // في تلات ملفات عشان تحط فورم في نافذة. دلوقتي كفاية تلفّه بـ`<FormDialog>`.
    // بره النافذة `useFormDialogClose()` بترجّع null والسطر ده مابيعملش حاجة.
    if (!failed) closeDialog?.();
    if (!failed || !preserveOnError) return;
    const form = formRef.current;
    if (!form) return;

    for (const element of Array.from(form.elements)) {
      if (!isRestorable(element) || !element.name) continue;
      const values = snapshot.getAll(element.name).filter((v) => typeof v === "string") as string[];
      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        element.checked = values.includes(element.value);
        continue;
      }
      // مفيش قيمة متبعتة = الحقل كان فاضي وقت الإرسال، فسيبه فاضي.
      if (values.length === 0) continue;
      // الحقول المتحكَّم فيها (`useState`) أصلًا بتنجو من الـreset، فالقيمة هتبقى مطابقة
      // والكتابة دي مالهاش أثر — مابنعملهاش عشان مانبوّظش تزامن React معاها.
      if (element.value !== values[0]) element.value = values[0];
    }
  }, [state, preserveOnError, closeDialog]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        onSubmit?.(event);
        if (!event.defaultPrevented) submitted.current = new FormData(event.currentTarget);
      }}
      {...props}
    />
  );
}
