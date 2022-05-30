import { Program, resolvePath } from "@cadl-lang/compiler";
import { renderProgram } from "./ui.js";

export async function $onEmit(program: Program) {
  const csdl = renderProgram(program);
  const csdlPath = resolvePath(program.compilerOptions.outputPath!, "cadl.csdl");
  await program.host.writeFile(
    csdlPath,
    `<!DOCTYPE html><html lang="en"><link rel="stylesheet" href="style.css"><body>${csdl}</body></html>`
  );
}
