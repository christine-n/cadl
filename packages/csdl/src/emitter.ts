import { Program, resolvePath } from "@cadl-lang/compiler";
import { renderProgram } from "./ui.js";

export async function $onEmit(program: Program) {
  const html = renderProgram(program);
  const htmlPath = resolvePath(program.compilerOptions.outputPath!, "cadl.html");
  await program.host.writeFile(htmlPath, html);
}
