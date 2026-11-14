-- Pareamento: libera autorização estendida (até 7 dias = 10080 min). Mudança ADITIVA: só afrouxa o teto do check.
-- O token de acesso continua curto (~15 min) e rotativo; o lojista só pode REDUZIR a duração ao aprovar (já garantido em pair_aprovar).
alter table public.pair_desafios drop constraint if exists pair_desafios_duracao_solicitada_min_check;
alter table public.pair_desafios add constraint pair_desafios_duracao_solicitada_min_check check (duracao_solicitada_min between 5 and 10080);
