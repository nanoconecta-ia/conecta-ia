// Runner do executor Windows: spawn SEM shell do argv montado pelo despachante (lista permitida + parâmetros validados).
// `binario` é injetável: no dispositivo seria "powershell.exe"; nos testes é um executável falso. Nada aqui instala nem roda no PC da Mobis.
import { spawn } from "node:child_process";
const MAX_SAIDA = 64 * 1024;                         // BYTES (UTF-8), não caracteres: mesmo teto do banco
const MARCA = Buffer.from("…[truncado]", "utf8");

/** Corta em no máximo `max` bytes sem partir um caractere UTF-8. */
export function cortarUtf8(buf, max) {
  if (buf.length <= max) return buf;
  let fim = max;
  while (fim > 0 && (buf[fim] & 0xc0) === 0x80) fim--;   // buf[fim] é continuação: o caractere começou antes; recua até o início dele
  return buf.subarray(0, fim);
}

export function criarRunnerWindows({ binario, argsAntes = [] } = {}) {
  return {
    executar(executor, argv, timeoutMs, sinal) {
      if (executor !== "windows") return Promise.reject(new Error("runner_so_windows"));
      if (!Array.isArray(argv) || argv[0] !== "powershell.exe") return Promise.reject(new Error("argv_inesperado"));
      return new Promise((resolve, reject) => {
        if (sinal.aborted) return reject(new Error("abortado"));
        const filho = spawn(binario ?? argv[0], [...argsAntes, ...argv.slice(1)], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const pedacos = []; let total = 0, erro = "", truncou = false;
        const matar = () => { try { filho.kill("SIGKILL"); } catch { /* já saiu */ } };
        const aoAbortar = () => { matar(); reject(new Error("abortado")); };
        sinal.addEventListener("abort", aoAbortar);
        filho.stdout.on("data", (b) => { if (total < MAX_SAIDA + 8) { pedacos.push(b); total += b.length; } else truncou = true; });
        filho.stderr.on("data", (b) => { if (erro.length < 2000) erro += b.toString("utf8"); });
        filho.on("error", (e) => { sinal.removeEventListener("abort", aoAbortar); reject(new Error("falha_ao_iniciar:" + e.code)); });
        filho.on("close", (codigo) => {
          sinal.removeEventListener("abort", aoAbortar);
          if (codigo !== 0) return reject(new Error(`saida_${codigo}`));
          const todo = Buffer.concat(pedacos); const estourou = truncou || todo.length > MAX_SAIDA;
          const corpo = estourou ? Buffer.concat([cortarUtf8(todo, MAX_SAIDA - MARCA.length), MARCA]) : todo;   // total final ≤ 65536 bytes, marca incluída
          resolve({ saida: corpo.toString("utf8").trim(), truncada: estourou });
        });
      });
    },
  };
}
