# منظومة أبوهيبة للتصدير — Platform

Next.js 16 + TypeScript + Prisma 7 (Modular Monolith على PostgreSQL/Supabase).

**قبل أي حاجة تانية:** اقرأ [`STATUS.md`](STATUS.md) — فيه حالة المشروع الفعلية، القرارات المعمارية وسببها، وترتيب التنفيذ. `CLAUDE.md` بيتقرأ تلقائيًا في بداية أي جلسة Claude Code.

## البداية

```bash
npm install
cp .env.example .env   # املأ DATABASE_URL بعد إنشاء Supabase project
npx prisma generate
npm run dev
```

`npx prisma migrate dev` محتاج `DATABASE_URL` فعلي (Supabase) — مش مضبوط لسه، راجع `STATUS.md` قسم P0.

## المرجع

- [`docs/ERD.md`](docs/ERD.md) — مخطط قاعدة البيانات الملزم (92 كيان، v3).
- [`docs/SCOPE-P1.md`](docs/SCOPE-P1.md) — نطاق P1 الفعلي (المصادقة، المنتج، السوق، العملاء الأساسية) — هذا هو اللي `prisma/schema.prisma` بيغطيه دلوقتي، مش كل الـERD.
- [`docs/REVIEW-2026-08.md`](docs/REVIEW-2026-08.md) — المراجعة النقدية ومستجدات 2026.
