/**
 * Gera configurações DESCARTÁVEIS para um ÚNICO workflow GitHub Actions.
 * Não chama a Cloudflare. Impede colisão com outros Workers da conta.
 * Deve ser executado apenas com entradas controladas; sem dados da Mobis.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!/^[0-9]{5,16}$/.test(id ?? "")) throw new Error("run_id_invalido");
const hostName = `nanoia-hml-host-${id}`;
const parentName = `nanoia-hml-pai-${id}`;
if (hostName.length > 63 || parentName.length > 63) throw new Error("worker_name_invalido");
const load = name => JSON.parse(readFileSync(join(dir, name), "utf8"));
const host = load("wrangler-host.jsonc");
const parent = load("wrangler-parent.jsonc");
if (host.workers_dev !== false || parent.workers_dev !== true ||
    host.durable_objects?.bindings?.[0]?.class_name !== "ReplayAuditoriaHml" ||
    parent.worker_loaders?.[0]?.binding !== "LOADER" ||
    parent.services?.length !== 1 || parent.services[0]?.binding !== "PILOT_HOST_SERVICE" ||
    parent.vars?.PILOT_BRIDGE_TRANSPORT !== "service" ||
    parent.vars?.PILOT_BRIDGE_ENABLED !== "true") throw new Error("configuracao_template_insegura");
host.name = hostName;
parent.name = parentName;
parent.services[0].service = hostName;
const hPath = join(dir, `.run-${id}-host.jsonc`);
const pPath = join(dir, `.run-${id}-pai.jsonc`);
writeFileSync(hPath, JSON.stringify(host, null, 2) + "\n", { mode: 0o600, flag: "wx" });
writeFileSync(pPath, JSON.stringify(parent, null, 2) + "\n", { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ hostName, parentName, hostConfig: hPath, parentConfig: pPath }));
