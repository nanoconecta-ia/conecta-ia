// Tipos mínimos das APIs de extensão usadas no piloto (evita instalar @types/chrome só para isto).
declare namespace chrome {
  namespace sidePanel { function setPanelBehavior(o: { openPanelOnActionClick: boolean }): Promise<void>; }
  namespace tabs { interface Tab { id?: number; url?: string } function query(q: { active: boolean; currentWindow: boolean }): Promise<Tab[]>; }
  namespace permissions { function request(p: { origins: string[] }): Promise<boolean>; }
  namespace scripting {
    function executeScript<T>(o: { target: { tabId: number }; files?: string[]; func?: () => T }): Promise<{ result?: T }[]>;
  }
}
