import { test } from "node:test";
import assert from "node:assert/strict";
import { decodificarVin } from "./vin.ts";

test("VIN: formato e rejeições", () => {
  assert.equal(decodificarVin("ABC").valido, false);
  assert.match(decodificarVin("1HGCM82633A00435Q").erro ?? "", /inválidos/);
});
test("VIN: estrutura, ano-modelo candidato e dígito verificador (exemplo público da norma)", () => {
  const v = decodificarVin("1M8GDM9AXKP042788", 2026);
  assert.equal(v.valido, true);
  assert.equal(v.wmi, "1M8");
  assert.deepEqual(v.anoModeloCandidatos, [1989, 2019]);
  assert.equal(v.digitoVerificadorConfere, true);
});
test("VIN: aceita espaços e minúsculas; ano-modelo nunca no futuro distante", () => {
  const v = decodificarVin("1m8gdm9axkp042788", 2026);
  assert.equal(v.valido, true);
  assert.ok(v.anoModeloCandidatos!.every((a) => a <= 2027));
});
