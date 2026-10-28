// Executável FALSO que imita o PowerShell só o bastante para o teste: lê o -Command e responde conforme o cmdlet.
const i = process.argv.indexOf("-Command"); const cmd = process.argv[i + 1] ?? "";
if (cmd.startsWith("Get-CimInstance Win32_OperatingSystem")) console.log('{"Caption":"Windows FICTICIO","Version":"0.0","OSArchitecture":"64-bit"}');
else if (cmd.startsWith("Get-Process")) console.log('{"Count":1}');
else if (cmd === "dorme") setTimeout(() => {}, 60000);
else if (cmd === "grande") console.log("x".repeat(200000));
else if (cmd === "falha") process.exit(3);
else { console.error("cmdlet desconhecido do falso"); process.exit(2); }
