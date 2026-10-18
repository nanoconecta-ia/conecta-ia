-- Anexos do chat do Conector IA (Fase 1, PROPOSTA: não aplicar em produção sem aprovação específica).
-- Bucket PRIVADO e sem nenhuma política para o navegador: quem envia e quem lê é a Edge Function (service_role), que entrega
-- URLs assinadas de curta duração. O caminho é sempre <loja_id>/<user_id>/<arquivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agente-anexos', 'agente-anexos', false, 20971520,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'])
on conflict (id) do nothing;
