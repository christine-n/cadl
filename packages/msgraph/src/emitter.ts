import { Program, resolvePath } from "@cadl-lang/compiler";
import { renderCsdl } from "./csdl.js";
import { renderProgram } from "./ui.js";

export async function $onEmit(program: Program) {
  const html = renderProgram(program);
  const htmlPath = resolvePath(program.compilerOptions.outputPath!, "cadl.html");
  await program.host.writeFile(htmlPath, html);

  const csdl = renderCsdl(program);
  const csdlPath = resolvePath(program.compilerOptions.outputPath!, "csdl.xml");
  await program.host.writeFile(csdlPath, csdl);
}
