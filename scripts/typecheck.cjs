const fs = require("fs");
try {
  const ts = require("typescript");
  const configPath = ts.findConfigFile(process.cwd(), (f) => ts.sys.fileExists(f), "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true, incremental: undefined });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const report = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (f) => f,
    getNewLine: () => "\n",
  });
  fs.writeFileSync("tsc-report.txt", report || "(no diagnostics)\n");
} catch (e) {
  fs.writeFileSync("tsc-report.txt", "SCRIPT_ERROR " + (e && e.stack ? e.stack : String(e)));
}
