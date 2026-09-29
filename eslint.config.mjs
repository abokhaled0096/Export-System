import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // بادئة `_` معناها "غير مستخدَم عن قصد" — والمشروع مستخدمها فعلًا في الأماكن اللي
      // توقيع الدالة بيفرض فيها باراميتر مش محتاجينه: `useActionState` بيمرّر الحالة
      // السابقة كأول باراميتر (`_prevState`)، و`useOptimistic` بيمرّر الإجراء للمخفِّض
      // (`_id`). حذفهم مستحيل لأنهم موضعيين، فالاتفاقية دي هي الطريقة الصح للتعبير عن
      // النية بدل ما نسكّت القاعدة بتعليق في كل موضع.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
