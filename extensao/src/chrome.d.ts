// Tipos mínimos das APIs de extensão usadas no piloto (evita instalar @types/chrome só para isto).
declare namespace chrome {
  namespace sidePanel { function setPanelBehavior(o: { openPanelOnActionClick: boolean }): Promise<void>; }
  namespace tabs { interface Tab { id?: number; url?: string } function query(q: { active: boolean; currentWindow: boolean }): Promise<Tab[]>; function create(o: { url: string }): Promise<Tab>; }
  namespace storage { namespace session { function set(o: Record<string, unknown>): Promise<void>; function get(k: string): Promise<Record<string, unknown>>; function remove(k: string): Promise<void>; } }
  namespace permissions { function request(p: { origins: string[] }): Promise<boolean>; }
  namespace scripting {
    function executeScript<T, A extends unknown[] = []>(o: { target: { tabId: number }; files?: string[]; func?: (...a: A) => T; args?: A }): Promise<{ result?: T }[]>;
  }
}
