/**
 * محرك جدولة أقساط قروض تلقائي — بند من BACKLOG.md § وحدة 8 ("جدولة أقساط القروض يدوية
 * بالكامل"). `interestRatePct` معاملة كسعر فائدة اسمي سنوي (Nominal Annual Rate)، والمعدل
 * الدوري لكل قسط شهري = السنوي ÷ 12 — نفس الاتفاقية المستخدمة في كل حاسبات القروض البنكية
 * التقليدية (بدون تركيب فعلي/Effective Rate)، ومفيش داعي نخترع اتفاقية تانية.
 *
 * طريقتان مدعومتان (نفس نمط FixedAsset.depreciationMethod — طريقة واحدة أشيع تجاريًا +
 * طريقة تانية أساسية، بدل تخمين طريقة واحدة بس):
 * - EqualInstallment (قسط ثابت، Annuity/French): كل قسط بنفس الإجمالي، الفائدة بتتحسب على
 *   الرصيد المتبقي فعليًا (declining balance)، مش على الأصل الأصلي.
 * - EqualPrincipal (أصل ثابت): حصة الأصل ثابتة، والفائدة بتتناقص مع الرصيد.
 *
 * ⚠️ تقريب القسط الأخير: قسمة الأصل على N قسط بيسيب فرق قرشي (Rounding) بعد التقريب لأقرب
 * قرشين في كل قسط. الحل المعياري (مش اختراع): القسط الأخير بياخد الباقي الفعلي من الرصيد
 * كامل بدل القيمة "النظرية" المقرَّبة، عشان الرصيد يقفل صفر بالظبط — مفيش قرش يتوه ولا يتضاعف.
 */

export type AmortizationMethod = "EqualInstallment" | "EqualPrincipal";

export type AmortizationScheduleLine = {
  dueDate: Date;
  principalPortion: number;
  interestPortion: number;
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateAmortizationSchedule(params: {
  principal: number;
  interestRatePct: number;
  numberOfInstallments: number;
  method: AmortizationMethod;
  startDate: Date;
}): AmortizationScheduleLine[] {
  const { principal, interestRatePct, numberOfInstallments: n, method, startDate } = params;
  const periodicRate = interestRatePct / 100 / 12;

  const lines: AmortizationScheduleLine[] = [];
  let balance = principal;

  if (method === "EqualInstallment") {
    const level = periodicRate === 0 ? principal / n : (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -n));
    for (let i = 1; i <= n; i++) {
      const interest = round2(balance * periodicRate);
      let principalPortion: number;
      if (i === n) {
        principalPortion = round2(balance); // القسط الأخير: يقفل الرصيد بالظبط بدل القيمة النظرية.
      } else {
        principalPortion = round2(level - interest);
      }
      balance = round2(balance - principalPortion);
      lines.push({ dueDate: addMonths(startDate, i), principalPortion, interestPortion: interest });
    }
  } else {
    const levelPrincipal = round2(principal / n);
    for (let i = 1; i <= n; i++) {
      const interest = round2(balance * periodicRate);
      const principalPortion = i === n ? round2(balance) : levelPrincipal;
      balance = round2(balance - principalPortion);
      lines.push({ dueDate: addMonths(startDate, i), principalPortion, interestPortion: interest });
    }
  }

  return lines;
}
