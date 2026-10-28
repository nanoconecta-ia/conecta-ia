// Executável FALSO que imita o PowerShell só o bastante para o teste: lê o -Command e responde conforme o cmdlet.
const i = process.argv.indexOf("-Command"); const cmd = process.argv[i + 1] ?? "";
if (cmd.startsWith("Get-CimInstance Win32_OperatingSystem")) console.log('{"Caption":"Windows FICTICIO","Version":"0.0","OSArchitecture":"64-bit"}');
else if (cmd.startsWith("[pscustomobject]")) console.log('{"Windows":"Microsoft Windows NT 10.0.0.0 FICTICIO","PowerShell":"5.1.0.0","Ferramentas":[{"Name":"node.exe","Version":"22.0.0.0","Source":"C:\\\\fake\\\\node.exe"}]}');
else if (cmd.startsWith("Get-Process")) console.log('{"Count":1}');
else if (cmd === "dorme") setTimeout(() => {}, 60000);
else if (cmd === "grande") console.log("x".repeat(200000));
else if (cmd === "falha") process.exit(3);
else { console.error("cmdlet desconhecido do falso"); process.exit(2); }
