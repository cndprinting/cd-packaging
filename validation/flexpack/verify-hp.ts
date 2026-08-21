// Regression guard: FlexPack must keep reproducing HP's own modelled job.
import { defaultFlexPackForm, computeFlexPack } from "../../src/lib/flexpack-estimate";
const f = defaultFlexPackForm();
f.quantity = 5000; f.skus = 1;
f.primerCostPerMsi = 0.015;
f.layers = [
  { name: "Gloss PET/ EVA Laminate | 1.2 Mil Pet", costPerMsi: 0.17 },
  { name: "48g Met PET", costPerMsi: 0.046 },
  { name: "3.5mil Clear PE | 3.5mil LDPE", costPerMsi: 0.205 },
];
// layout now derives from the bag itself — 4x6 with a 2" bottom gusset
f.bagWidthIn = 4; f.bagLengthIn = 6; f.gussetIn = 2; f.gussetLocation = "Bottom";
f.substrateWidthIn = 30; f.usableWebWidthIn = 28.669; f.maxRepeatLengthIn = 44;
f.colorsCmyovg = 3; f.colorsK = 1; f.colorsPremiumWhite = 1;
f.pressSpeedFpm = 110; f.runningWastePct = 4;
f.lamination = { ...f.lamination, enabled: true };
f.bagMaking = { ...f.bagMaking, enabled: true };
f.zipperCostPerBag = 0.005;
f.pricingMode = "pricePerM"; f.pricePerM = 300;
const c = computeFlexPack(f);
const chk = (k: string, hp: number, got: number, tol = 0.02) => {
  const ok = Math.abs(got - hp) <= tol;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${k.padEnd(22)} HP ${hp.toFixed(2).padStart(10)}  ours ${got.toFixed(2).padStart(10)}`);
  return ok;
};
let pass = true;
pass = chk("print width (in)", 14, c.printWidthIn, 0.001) && pass;
pass = chk("repeat (in)", 4, c.repeatIn, 0.001) && pass;
pass = chk("per frame", 22, c.perFrame, 0.001) && pass;
pass = chk("total lin ft", 1524.64, c.totalLinFt, 0.05) && pass;
pass = chk("total MSI", 548.8704, c.totalMsi, 0.05) && pass;
pass = chk("press", 169.28698564, c.pressCost) && pass;
pass = chk("lamination", 36.90043396, c.laminationCost) && pass;
pass = chk("bag making", 135.75666911, c.bagMakingCost) && pass;
pass = chk("clicks", 108.07611276, c.clickCost) && pass;
pass = chk("material", 239.30749440, c.materialCost) && pass;
pass = chk("TOTAL COST", 720.16102922, c.totalCost, 0.03) && pass;
pass = chk("margin %", 51.989264718874, c.marginPct * 100, 0.02) && pass;
console.log(pass ? "\nFlexPack matches HP." : "\nMISMATCH — investigate before shipping.");
process.exit(pass ? 0 : 1);
