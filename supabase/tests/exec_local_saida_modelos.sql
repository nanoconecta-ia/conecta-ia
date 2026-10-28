-- Testa a saída em BYTES (UTF-8), o hash do valor persistido, a sinalização de truncamento e a allowlist EXATA por capacidade
-- (20261029000001_exec_local_fila.sql). Uma loja fictícia; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create function public.h(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;
create function public.espera_erro(cmd text, estado text) returns void language plpgsql as $$
begin
  begin execute cmd; exception when others then
    if sqlstate = estado then raise notice 'ok: erro % esperado', estado; return; end if;
    raise exception 'FALHOU: esperava % mas veio % (%) em: %', estado, sqlstate, sqlerrm, left(cmd, 90);
  end;
  raise exception 'FALHOU: não deu erro (esperava %) em: %', estado, left(cmd, 90);
end $$;
create function public.argv(cmd text) returns text[] language sql immutable as
$$ select array['powershell.exe','-NoProfile','-NonInteractive','-NoLogo','-Command', cmd] $$;
create function public.c_inv() returns text language sql immutable as $$ select 'Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture,TotalVisibleMemorySize | ConvertTo-Json -Compress' $$;

insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a');
insert into public.usuarios_loja (loja_id, user_id, papel) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'lojista');
insert into public.pair_dispositivos (id, loja_id, usuario_id, nome, tipo, capacidades) values
  ('d0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'PC A', 'agente_desktop',
   '{windows.sistema.inventario,windows.ambiente.versoes,windows.disco.livre,windows.processo.existe,windows.servico.estado}');
insert into public.pair_sessoes (loja_id, usuario_id, dispositivo_id, token_hash, sal_hash, escopos, expira_em, limite_ate) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', public.h('tA'), public.h('sA'), '{produtos:ler}', now() + interval '1 hour', now() + interval '1 day');

-- um ciclo completo: enfileira (inventário), o agente puxa e devolve p_saida; devolve o estado lido pelo gateway
create function public.ciclo(p_saida text) returns jsonb language plpgsql as $$
declare v_id uuid; v_job jsonb;
begin
  v_id := public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', 'windows.sistema.inventario', public.argv(public.c_inv()), 5000);
  v_job := public.exec_local_puxar(public.h('tA'), public.h('sA'));
  if (v_job ->> 'job_id')::uuid <> v_id then raise exception 'FALHOU: puxou outra tarefa'; end if;
  perform public.exec_local_resultado(public.h('tA'), public.h('sA'), v_id, true, p_saida, null);
  return public.exec_local_estado('aaaaaaaa-0000-0000-0000-000000000001', v_id) || jsonb_build_object('id', v_id);
end $$;
grant execute on function public.ciclo(text) to service_role;
grant execute on function public.argv(text), public.c_inv(), public.h(text), public.afirma(boolean, text), public.espera_erro(text, text) to public;
set local role service_role;

-- allowlist exata: os 5 modelos aceitos com parâmetros válidos; parâmetro fora do padrão recusado
select public.afirma(public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.ambiente.versoes', public.argv('[pscustomobject]@{Windows=[System.Environment]::OSVersion.VersionString; PowerShell=$PSVersionTable.PSVersion.ToString(); Ferramentas=@(Get-Command node -ErrorAction SilentlyContinue | Select-Object Name,Version,Source)} | ConvertTo-Json -Compress'), 5000) is not null, 'modelo windows.ambiente.versoes aceito');
select public.afirma(public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.disco.livre', public.argv('Get-PSDrive -Name C | Select-Object Name,Used,Free | ConvertTo-Json -Compress'), 5000) is not null, 'modelo windows.disco.livre aceito');
select public.afirma(public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.processo.existe', public.argv('Get-Process -Name node -ErrorAction SilentlyContinue | Measure-Object | Select-Object Count | ConvertTo-Json -Compress'), 5000) is not null, 'modelo windows.processo.existe aceito');
select public.afirma(public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.servico.estado', public.argv('Get-Service -Name Spooler -ErrorAction SilentlyContinue | Select-Object Name,Status | ConvertTo-Json -Compress'), 5000) is not null, 'modelo windows.servico.estado aceito');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.processo.existe', public.argv('Get-Process -Name x; calc -ErrorAction SilentlyContinue | Measure-Object | Select-Object Count | ConvertTo-Json -Compress'), 5000)$$, '42501');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.disco.livre', public.argv('Get-PSDrive -Name CC | Select-Object Name,Used,Free | ConvertTo-Json -Compress'), 5000)$$, '42501');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.servico.estado', public.argv('Get-Service -Name Spooler -ErrorAction SilentlyContinue | Select-Object Name,Status | ConvertTo-Json -Compress' || chr(10) || 'whoami'), 5000)$$, '42501');
reset role;
delete from public.exec_local_tarefas;      -- limpa as 4 tarefas acima (não puxadas) para os ciclos abaixo
set local role service_role;

-- saída em BYTES, hash do valor persistido, sinalização
create temp table s (nome text primary key, j jsonb); grant all on s to service_role;
insert into s select 'asc_exata', public.ciclo(repeat('a', 65536));
insert into s select 'asc_mais1', public.ciclo(repeat('a', 65537));
insert into s select 'acento', public.ciclo(repeat('é', 70000));
insert into s select 'emoji', public.ciclo(repeat('😀', 70000));
insert into s select 'misto', public.ciclo(repeat('aé€😀', 30000));
insert into s select 'curto_mb', public.ciclo(repeat('é€😀', 100));
select public.afirma(not (select (j ->> 'truncada')::boolean from s where nome = 'asc_exata') and octet_length((select j ->> 'saida' from s where nome = 'asc_exata')) = 65536, '65536 bytes exatos: não trunca');
select public.afirma((select (j ->> 'truncada')::boolean from s where nome = 'asc_mais1') and octet_length((select j ->> 'saida' from s where nome = 'asc_mais1')) = 65536, '65537 bytes: trunca em 65536 e sinaliza');
select public.afirma(not (select (j ->> 'truncada')::boolean from s where nome = 'curto_mb') and (select j ->> 'saida' from s where nome = 'curto_mb') = repeat('é€😀', 100), 'multibyte curto passa intacto');
select public.afirma((select bool_and(octet_length(j ->> 'saida') <= 65536) from s), 'toda saída persistida respeita 65536 BYTES (ASCII, 2, 3 e 4 bytes)');
select public.afirma((select bool_and(position(chr(65533) in (j ->> 'saida')) = 0) from s), 'nenhum caractere partido (sem U+FFFD)');
select public.afirma((select (j ->> 'saida') = left(repeat('😀', 70000), length(j ->> 'saida')) from s where nome = 'emoji'), 'o valor truncado é prefixo do original');
select public.afirma((select (j ->> 'sha256') = public.h(j ->> 'saida') from s where nome = 'emoji')
                 and (select bool_and((j ->> 'sha256') = public.h(j ->> 'saida')) from s), 'o hash é do valor EXATO persistido (não do original)');
select public.afirma((select (j ->> 'bytes_originais')::int from s where nome = 'emoji') = 280000 and (select (j ->> 'bytes_originais')::int from s where nome = 'acento') = 140000, 'bytes originais registrados');
select public.afirma((select (j ->> 'truncada')::boolean from s where nome = 'misto'), 'misto grande também sinaliza');
reset role;
select public.afirma((select bool_and(octet_length(private.exec_local_cortar_bytes(repeat(c, 70000), 65536)) <= 65536
                      and octet_length(private.exec_local_cortar_bytes(repeat(c, 70000), 65536)) > 65536 - 4)
                       from unnest(array['a', 'é', '€', '😀']) c), 'corte nunca ultrapassa o limite (1, 2, 3 e 4 bytes) e perde no máximo 3 bytes');
select public.afirma(private.exec_local_cortar_bytes(null, 10) = '' and private.exec_local_cortar_bytes('abc', 10) = 'abc', 'corte: nulo vira vazio; texto curto intacto');
select public.afirma((select count(*) from public.auditoria where acao like 'exec_local.%' and (depois::text like '%saida%' or depois::text like '%aaaa%' or depois::text like '%😀%')) = 0, 'auditoria não carrega a saída nem dado sensível');
rollback;
