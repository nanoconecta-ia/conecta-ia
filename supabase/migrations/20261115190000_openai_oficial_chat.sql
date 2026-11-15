-- Provedor oficial da API OpenAI, separado de Groq/compativel_openai.
-- Reutiliza funções já existentes, preservando RLS, privilégios, idempotência e auditoria.
-- Nenhuma chave ou configuração é inserida automaticamente; a loja cadastra nas Integrações.
create or replace function public.chat_iniciar(p_loja uuid,p_user uuid,p_conversa uuid,p_texto text,p_idem text,p_provedor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.conversas; q public.mensagens; a public.mensagens; v_conversa uuid:=p_conversa; tok uuid;
begin
 if not private.chat_vinculo(p_loja,p_user) then raise exception 'acesso negado' using errcode='42501'; end if;
 if not private.chat_recurso(p_loja,'chat_persistente') then raise exception 'histórico desligado' using errcode='55000'; end if;
 if p_texto is null or char_length(btrim(p_texto)) not between 1 and 1000 or p_idem is null or char_length(p_idem) not between 8 and 120
 or (p_provedor is not null and p_provedor not in ('claude','gemini','compativel_openai','openai','openrouter_free')) then raise exception 'turno inválido' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_loja::text||p_user::text||p_idem,0));
 select * into q from public.mensagens where loja_id=p_loja and user_id=p_user and idempotency_key=p_idem and papel='usuario';
 if found then
   if q.conteudo<>p_texto or (p_conversa is not null and q.conversa_id<>p_conversa) then raise exception 'idempotência incompatível' using errcode='22023'; end if;
   if not private.chat_visivel(p_loja,q.criada_em) then raise exception 'turno expirado' using errcode='P0002'; end if;
   select * into a from public.mensagens where em_resposta_a=q.id;
   if found then return jsonb_build_object('estado','concluido','conversa_id',q.conversa_id,'resposta',a.conteudo,'metadados',a.metadados); end if;
   -- Uma chamada externa pode ter acontecido antes da queda. Não repetir automaticamente depois do prazo.
   select * into c from public.conversas where id=q.conversa_id for update;
   return jsonb_build_object('estado',case when c.turno_ate>now() then 'em_execucao' else 'interrompido' end,'conversa_id',q.conversa_id);
 end if;
 if v_conversa is null then
  insert into public.conversas(loja_id,user_id,titulo) values(p_loja,p_user,left(regexp_replace(p_texto,'\s+',' ','g'),60)) returning * into c;
 else
  select * into c from public.conversas where id=v_conversa and loja_id=p_loja and user_id=p_user and private.chat_visivel(loja_id,atualizada_em) for update;
  if not found then raise exception 'conversa inexistente' using errcode='P0002'; end if;
 end if;
 if c.turno_ate>now() then return jsonb_build_object('estado','em_execucao','conversa_id',c.id); end if;
 tok:=gen_random_uuid();
 insert into public.mensagens(loja_id,user_id,conversa_id,papel,conteudo,idempotency_key,metadados)
 values(p_loja,p_user,c.id,'usuario',p_texto,p_idem,jsonb_build_object('provedor',p_provedor)) returning * into q;
 update public.conversas set turno_token=tok,turno_pergunta=q.id,turno_ate=now()+interval '15 minutes',atualizada_em=now(),titulo=left(regexp_replace(p_texto,'\s+',' ','g'),60) where id=c.id;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values(p_loja,p_user,'chat.turno_iniciado','mensagens',jsonb_build_object('conversa_id',c.id,'pergunta_id',q.id,'provedor',p_provedor));
 return jsonb_build_object('estado','novo','conversa_id',c.id,'pergunta_id',q.id,'turno_token',tok);
end $$;

create or replace function public.chat_responder(p_loja uuid,p_user uuid,p_pergunta uuid,p_token uuid,p_resposta text,p_meta jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.conversas; mid uuid; prov text; nt int;
begin
 if not private.chat_vinculo(p_loja,p_user) then raise exception 'acesso negado' using errcode='42501'; end if;
 select * into c from public.conversas where loja_id=p_loja and user_id=p_user and turno_pergunta=p_pergunta for update;
 if not found or c.turno_token is distinct from p_token or p_token is null or c.turno_ate<=now() then raise exception 'reserva inválida' using errcode='42501'; end if;
 if p_meta is null or jsonb_typeof(p_meta)<>'object' or pg_column_size(p_meta)>65536 then raise exception 'metadados inválidos'; end if;
 insert into public.mensagens(loja_id,user_id,conversa_id,papel,conteudo,em_resposta_a,metadados)
 values(p_loja,p_user,c.id,'assistente',left(p_resposta,8000),p_pergunta,p_meta) returning id into mid;
 prov:=p_meta->>'provedor'; nt:=coalesce((p_meta->>'tokens')::int,0);
 if nt<0 then raise exception 'tokens inválidos'; end if;
 if prov in ('claude','gemini','compativel_openai','openai','openrouter_free') and nt>0 then perform public.ia_registrar_uso(p_loja,prov,nt); end if;
 update public.conversas set turno_token=null,turno_pergunta=null,turno_ate=null,atualizada_em=now() where id=c.id;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values(p_loja,p_user,'chat.turno_concluido','mensagens',
 jsonb_build_object('conversa_id',c.id,'mensagem_id',mid,'provedor',prov,'modelo',p_meta->>'modelo','resposta_id',p_meta->>'resposta_id','tokens',nt,'simulado',p_meta->'simulado','desfecho',p_meta->>'desfecho'));
 return mid;
end $$;

-- Confirma que as funções continuam restritas ao servidor.
DO $$ BEGIN
 IF has_function_privilege('anon', 'public.chat_iniciar(uuid,uuid,uuid,text,text,text)', 'execute')
 OR has_function_privilege('authenticated', 'public.chat_iniciar(uuid,uuid,uuid,text,text,text)', 'execute')
 OR has_function_privilege('anon', 'public.chat_responder(uuid,uuid,uuid,uuid,text,jsonb)', 'execute')
 OR has_function_privilege('authenticated', 'public.chat_responder(uuid,uuid,uuid,uuid,text,jsonb)', 'execute')
 THEN RAISE EXCEPTION 'Funcoes do chat nao podem ser executadas pelo navegador'; END IF;
END $$;
