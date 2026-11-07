/* Penny Wise: chave pública VAPID para as notificações Web Push
   (resumo mensal, dia 1). É segura para estar aqui, no browser — só
   a chave PRIVADA (que fica só como segredo "VAPID_PRIVATE_KEY" na
   Edge Function do Supabase, nunca aqui) é que assina as
   notificações. Gerada uma única vez para este projeto; só precisa de
   ser trocada se um dia quiseres invalidar todas as subscrições
   antigas. */

window.PENNY_PUSH = {
  vapidPublicKey: 'BMDi3R9iaY2ZP1nXP4kP8WpMSClsbWqD5P0bkpCfzbmgcGuwtmpY3-ImuNeMvQ2x4xOsqvLGiMQ9_A8EQV1PNLw'
};
