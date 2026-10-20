import sprite from "../assets/sprite-icones.svg?raw";

/** Conjunto de símbolos SVG (ícones de peças e veículos, logo do Conecta.IA, gradientes). Montado uma vez na raiz; os ícones o usam por <use href="#id">.
 *  O conteúdo é um arquivo estático do próprio repositório, nunca dado de usuário. */
export function SpriteIcones() {
  return <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: sprite }} />;
}
