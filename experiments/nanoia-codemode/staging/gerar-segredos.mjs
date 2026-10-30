/**
 * CI exclusivo de homologação. Cria credenciais efêmeras para os dois Workers
 * e nunca as coloca em logs/artefatos. A execução precisa ser aprovada antes.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const id=process.argv[2], gitEnv=process.env.GITHUB_ENV;
if(!/^[0-9]{5,16}$/.test(id??"")||!gitEnv)throw Error("fora_do_runner");
const dir=dirname(fileURLToPath(import.meta.url));
const secret=()=>randomBytes(48).toString("base64url");
const hA=secret(),hB=secret(),a=secret(),b=secret();
const mask=(v)=>process.stdout.write("::add-mask::"+v+"\n");
for(const value of [hA,hB,a,b])mask(value);
writeFileSync(join(dir,`.run-${id}-host-secrets.json`),JSON.stringify({STAGING_HMAC_A:hA,STAGING_HMAC_B:hB}),
  {mode:0o600,flag:"wx"});
writeFileSync(join(dir,`.run-${id}-pai-secrets.json`),JSON.stringify({
  PILOT_HOST_SECRET_A:hA,PILOT_HOST_SECRET_B:hB,PILOT_TOKEN_A:a,PILOT_TOKEN_B:b
}),{mode:0o600,flag:"wx"});
appendFileSync(gitEnv,`NANOIA_HML_TOKEN_A=${a}\nNANOIA_HML_TOKEN_B=${b}\n`,{mode:0o600});
console.log("Credenciais efêmeras geradas para host e pai; valores omitidos.");
