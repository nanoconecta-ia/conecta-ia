/** Só gera configurações distintas para dois Workers convencionais FREE; nunca faz deploy. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir=dirname(fileURLToPath(import.meta.url)),id=process.argv[2];
if(!/^[0-9]{5,16}$/.test(id??""))throw Error("run_id_invalido");
const host=JSON.parse(readFileSync(join(dir,"wrangler-host.jsonc"),"utf8"));
const parent=JSON.parse(readFileSync(join(dir,"wrangler-free-parent.jsonc"),"utf8"));
if(host.workers_dev!==false || host.durable_objects?.bindings?.[0]?.class_name!=="ReplayAuditoriaHml" ||
 parent.worker_loaders || parent.workers_dev!==false || parent.vars?.PILOT_ENABLED!=="false" ||
 parent.services?.[0]?.binding!=="PILOT_HOST_SERVICE")
 throw Error("template_free_inseguro");
host.name="nanoia-hml-free-host-"+id;
parent.name="nanoia-hml-free-pai-"+id;
parent.workers_dev=true; // URL temporária, protegida por Bearer; host continua privado.
parent.vars.PILOT_ENABLED="true";
parent.services[0].service=host.name;
if(host.name.length>63 || parent.name.length>63)throw Error("nome_invalido");
const write=(name,data)=>writeFileSync(join(dir,`.run-${id}-${name}.jsonc`),
 JSON.stringify(data,null,2)+"\n",{mode:0o600,flag:"wx"});
write("host",host);write("pai",parent);
console.log("Configuração Workers Free criada com nomes únicos, sem segredos e sem publicação.");
