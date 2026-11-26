// Recebe somente páginas da API pública. Ausência de dados de motor/ano não
// autoriza escolher uma ficha por suposição. Nunca altera o SKU.
export interface FichaAplicacao {slug:string;titulo:string;modelo:string;status:string;motorizacao?:string|null;ano_inicial?:number|null;ano_final?:number|null}
export function paginasDaSelecao<T extends FichaAplicacao>(paginas:T[],f:{modelo?:string;motor?:string;ano?:string}):T[]{
  return paginas.filter(p=>{
    if(p.status!=="aprovado"||!p.slug||!p.titulo)return false;
    if(f.modelo&&p.modelo!==f.modelo)return false;
    if(f.motor&&p.motorizacao!==f.motor)return false;
    if(f.ano){const ano=Number(f.ano);const i=p.ano_inicial??p.ano_final;const j=p.ano_final??p.ano_inicial;if(!Number.isInteger(ano)||i==null||j==null||ano<i||ano>j)return false}
    return true;
  });
}
export function rotuloAplicacao(p:FichaAplicacao):string{
  const periodo=p.ano_inicial!=null&&p.ano_final!=null?p.ano_inicial===p.ano_final?String(p.ano_inicial):p.ano_inicial+"–"+p.ano_final:p.ano_inicial!=null?"Ano inicial "+p.ano_inicial:p.ano_final!=null?"Ano final "+p.ano_final:"";
  return [p.modelo,p.motorizacao,periodo].filter(Boolean).join(" · ");
}
