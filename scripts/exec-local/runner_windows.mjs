// Runner do executor Windows: spawn SEM shell do argv montado pelo despachante (lista permitida + parâmetros validados).
// `binario` é injetável: no dispositivo seria "powershell.exe"; nos testes é um executável falso. Nada aqui instala nem roda no PC da Mobis.
import { spawn } from "node:child_process";
const MAX_SAIDA = 64 * 1024;

export function criarRunnerWindows({ binario, argsAntes = [] } = {}) {
  return {
    executar(executor, argv, timeoutMs, sinal) {
      if (executor !== "windows") return Promise.reject(new Error("runner_so_windows"));
      if (!Array.isArray(argv) || argv[0] !== "powershell.exe") return Promise.reject(new Error("argv_inesperado"));
      return new Promise((resolve, reject) => {
        if (sinal.aborted) return reject(new Error("abortado"));
        const filho = spawn(binario ?? argv[0], [...argsAntes, ...argv.slice(1)], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let saida = "", erro = "", truncou = false;
        const matar = () => { try { filho.kill("SIGKILL"); } catch { /* já saiu */ } };
        const aoAbortar = () => { matar(); reject(new Error("abortado")); };
        sinal.addEventListener("abort", aoAbortar);
        filho.stdout.on("data", (b) => { if (saida.length < MAX_SAIDA) saida += b.toString("utf8"); else truncou = true; });
        filho.stderr.on("data", (b) => { if (erro.length < 2000) erro += b.toString("utf8"); });
        filho.on("error", (e) => { sinal.removeEventListener("abort", aoAbortar); reject(new Error("falha_ao_iniciar:" + e.code)); });
        filho.on("close", (codigo) => {
          sinal.removeEventListener("abort", aoAbortar);
          if (codigo !== 0) return reject(new Error(`saida_${codigo}`));
          resolve({ saida: (truncou ? saida.slice(0, MAX_SAIDA) + "…[truncado]" : saida).trim() });
        });
      });
    },
  };
}
