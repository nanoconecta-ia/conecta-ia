// Validador mínimo de JSON Schema (o subconjunto que o registro usa). Recusa campos desconhecidos quando
// additionalProperties === false: é o que impede o Bling de receber campo fora da lista permitida.
import type { JsonSchema } from "./tipos.ts";

export interface ErroSchema { caminho: string; erro: string }

export function validar(schema: JsonSchema, valor: unknown, caminho = "$"): ErroSchema[] {
  const erros: ErroSchema[] = [];
  const falha = (erro: string) => erros.push({ caminho, erro });
  if (valor === null || valor === undefined) {
    if (schema.type === "null") return erros;
    falha("valor ausente"); return erros;
  }
  switch (schema.type) {
    case "string": {
      if (typeof valor !== "string") { falha("deve ser texto"); break; }
      if (schema.minLength != null && valor.length < schema.minLength) falha(`mínimo ${schema.minLength} caracteres`);
      if (schema.maxLength != null && valor.length > schema.maxLength) falha(`máximo ${schema.maxLength} caracteres`);
      if (schema.pattern && !new RegExp(schema.pattern).test(valor)) falha("formato inválido");
      if (schema.enum && !schema.enum.includes(valor)) falha(`valor fora da lista: ${schema.enum.join(", ")}`);
      break;
    }
    case "number": case "integer": {
      if (typeof valor !== "number" || !Number.isFinite(valor)) { falha("deve ser número"); break; }
      if (schema.type === "integer" && !Number.isInteger(valor)) falha("deve ser inteiro");
      if (schema.minimum != null && valor < schema.minimum) falha(`mínimo ${schema.minimum}`);
      if (schema.maximum != null && valor > schema.maximum) falha(`máximo ${schema.maximum}`);
      if (schema.enum && !schema.enum.includes(valor)) falha("valor fora da lista");
      break;
    }
    case "boolean": if (typeof valor !== "boolean") falha("deve ser verdadeiro/falso"); break;
    case "array": {
      if (!Array.isArray(valor)) { falha("deve ser lista"); break; }
      if (schema.maxItems != null && valor.length > schema.maxItems) falha(`máximo ${schema.maxItems} itens`);
      if (schema.minItems != null && valor.length < schema.minItems) falha(`mínimo ${schema.minItems} itens`);
      if (schema.items) valor.forEach((v, i) => erros.push(...validar(schema.items!, v, `${caminho}[${i}]`)));
      break;
    }
    case "object": case undefined: {
      if (typeof valor !== "object" || Array.isArray(valor)) { if (schema.type === "object") falha("deve ser objeto"); break; }
      const o = valor as Record<string, unknown>;
      for (const r of schema.required ?? []) if (o[r] === undefined || o[r] === null) erros.push({ caminho: `${caminho}.${r}`, erro: "obrigatório" });
      if (schema.additionalProperties === false) {
        for (const k of Object.keys(o)) if (!schema.properties || !(k in schema.properties)) erros.push({ caminho: `${caminho}.${k}`, erro: "campo não permitido" });
      }
      for (const [k, s] of Object.entries(schema.properties ?? {})) if (o[k] !== undefined && o[k] !== null) erros.push(...validar(s, o[k], `${caminho}.${k}`));
      break;
    }
    default: break;
  }
  return erros;
}

export const resumirErros = (e: ErroSchema[]) => e.slice(0, 5).map((x) => `${x.caminho}: ${x.erro}`).join("; ");
