// Registro estruturado de fabricantes e marcas (especificação 02/11/2026, seção 2). É uma LISTA DE PESQUISA, não de fornecedores homologados.
// REGRAS: nenhum domínio, catálogo ou grupo empresarial é escrito de memória aqui: `dominios` e `catalogos` começam VAZIOS e `status` começa "nao_verificado".
// Um domínio só passa a valer como fonte "fabricante_oficial" depois que uma PESSOA o cadastra e marca "verificado" (dado do cadastro, não código).
// Marcas de um mesmo grupo não são presumidas independentes: `grupo` fica null até haver fonte, e `independente` nunca é afirmado por este código.
export type CategoriaFabricante =
  | "motor_internos" | "juntas_vedacao" | "embreagem_transmissao" | "rolamentos_correias" | "injecao_eletrica" | "turbo" | "filtragem" | "arrefecimento" | "suspensao_freios" | "montadora_genuina";
export type StatusFabricante = "nao_verificado" | "em_verificacao" | "verificado";
export interface Fabricante {
  nome: string; categoria: CategoriaFabricante;
  /** Nomes que a pesquisa deve tratar como a mesma marca (ex.: "MAHLE / Metal Leve" gera os dois). */
  apelidos: string[];
  site_oficial: string | null; dominios: string[]; catalogos: string[];
  /** Grupo empresarial, só com fonte. null = desconhecido (NÃO é "independente"). */
  grupo: string | null;
  status: StatusFabricante;
}
const f = (categoria: CategoriaFabricante, nome: string, apelidos: string[] = []): Fabricante =>
  ({ nome, categoria, apelidos, site_oficial: null, dominios: [], catalogos: [], grupo: null, status: "nao_verificado" });

export const FABRICANTES_INICIAIS: readonly Fabricante[] = [
  f("motor_internos", "MAHLE", ["Metal Leve"]), f("motor_internos", "KS", ["Kolbenschmidt"]), f("motor_internos", "Motorservice"), f("motor_internos", "NPR"), f("motor_internos", "Nural"),
  f("motor_internos", "Federal-Mogul"), f("motor_internos", "Takao"), f("motor_internos", "Riosulense"), f("motor_internos", "MWM"), f("motor_internos", "Cummins"), f("motor_internos", "Perkins"), f("motor_internos", "Yanmar"),
  f("juntas_vedacao", "Sabó"), f("juntas_vedacao", "Jusa"), f("juntas_vedacao", "Ajusa"), f("juntas_vedacao", "Elring"), f("juntas_vedacao", "Victor Reinz"), f("juntas_vedacao", "Taranto"), f("juntas_vedacao", "Corteco"), f("juntas_vedacao", "Spaal"),
  f("embreagem_transmissao", "LuK"), f("embreagem_transmissao", "Sachs"), f("embreagem_transmissao", "Valeo"), f("embreagem_transmissao", "Eaton"), f("embreagem_transmissao", "ZF"), f("embreagem_transmissao", "Dana"), f("embreagem_transmissao", "Spicer"),
  f("rolamentos_correias", "SKF"), f("rolamentos_correias", "INA"), f("rolamentos_correias", "FAG"), f("rolamentos_correias", "NTN"), f("rolamentos_correias", "NSK"), f("rolamentos_correias", "Koyo"), f("rolamentos_correias", "Gates"), f("rolamentos_correias", "Dayco"), f("rolamentos_correias", "Continental"),
  f("injecao_eletrica", "Bosch"), f("injecao_eletrica", "Denso"), f("injecao_eletrica", "Delphi"), f("injecao_eletrica", "Continental VDO"), f("injecao_eletrica", "Stanadyne"), f("injecao_eletrica", "Mando"), f("injecao_eletrica", "Mitsubishi Electric"), f("injecao_eletrica", "NGK / NTK", ["NGK", "NTK"]),
  f("turbo", "Garrett"), f("turbo", "BorgWarner"), f("turbo", "Holset"), f("turbo", "IHI"), f("turbo", "Mitsubishi Turbocharger"),
  f("filtragem", "Tecfil"), f("filtragem", "MANN-FILTER"), f("filtragem", "MAHLE Filtros"), f("filtragem", "Wega"), f("filtragem", "Donaldson"), f("filtragem", "Fleetguard"), f("filtragem", "Parker Racor"),
  f("arrefecimento", "Urba"), f("arrefecimento", "Schadek"), f("arrefecimento", "Indisa"), f("arrefecimento", "MTE-Thomson"), f("arrefecimento", "Wahler"), f("arrefecimento", "Aisin"), f("arrefecimento", "GMB"),
  f("suspensao_freios", "Nakata"), f("suspensao_freios", "Cofap"), f("suspensao_freios", "Monroe"), f("suspensao_freios", "TRW"), f("suspensao_freios", "Fras-le"), f("suspensao_freios", "Cobreq"), f("suspensao_freios", "Fremax"), f("suspensao_freios", "Viemar"), f("suspensao_freios", "Hipper Freios"),
  f("montadora_genuina", "Hyundai Mobis"), f("montadora_genuina", "Kia Genuine Parts"), f("montadora_genuina", "Mitsubishi Genuine Parts"), f("montadora_genuina", "Toyota Genuine Parts"), f("montadora_genuina", "Nissan Genuine Parts"), f("montadora_genuina", "Ford Motorcraft"), f("montadora_genuina", "Mercedes-Benz Genuine Parts"),
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Acha a marca pelo nome ou apelido (sem acento e sem pontuação). Não adivinha por semelhança. */
export function acharFabricante(nome: string, lista: readonly Fabricante[] = FABRICANTES_INICIAIS): Fabricante | null {
  const n = norm(nome);
  return n ? lista.find((x) => [x.nome, ...x.apelidos].some((a) => norm(a) === n)) ?? null : null;
}
/** Classe de fonte por domínio, SÓ para domínios cadastrados e verificados. Montadora genuína vira "montadora_oficial"; os demais, "fabricante_oficial". */
export function dominiosConhecidos(lista: readonly Fabricante[]): Record<string, "fabricante_oficial" | "montadora_oficial"> {
  const m: Record<string, "fabricante_oficial" | "montadora_oficial"> = {};
  for (const x of lista) if (x.status === "verificado") for (const d of x.dominios) m[d.toLowerCase().replace(/^www\./, "")] = x.categoria === "montadora_genuina" ? "montadora_oficial" : "fabricante_oficial";
  return m;
}
