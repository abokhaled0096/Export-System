-- AlterEnum
-- قيمة جديدة بس — بلا استخدامها في نفس الـtransaction (الـseed اللي بيستخدمها بيتشغّل كخطوة منفصلة بعدها).
ALTER TYPE "PermissionAction" ADD VALUE 'Import';
