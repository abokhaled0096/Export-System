/** أنواع الكيانات المدعومة فعليًا في MasterDataChangeRequest — نفس القائمة اللي كانت
 * مكرّرة محليًا في src/app/governance/change-requests/page.tsx (ENTITY_LINK_BASE)، اتنقلت هنا
 * عشان تتشارك مع ChangeRequestForm.tsx (قائمة اختيار بدل كتابة اسم الكيان الإنجليزي يدويًا). */
export const ENTITY_LINK_BASE: Record<string, string> = {
  Company: "/companies",
  Supplier: "/suppliers",
  BankAccount: "/accounting/bank-accounts",
  Product: "/products",
  PurchaseOrder: "/purchase-orders",
};

export const entityTypeLabel: Record<string, string> = {
  Company: "شركة (عميل)",
  Supplier: "مورّد",
  BankAccount: "حساب بنكي",
  Product: "منتج",
  PurchaseOrder: "أمر شراء",
};
