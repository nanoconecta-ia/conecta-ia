// Service worker (Manifest V3): o ícone da extensão abre o painel lateral. Nenhuma rede, nenhum armazenamento de dados da loja.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { /* navegador sem side panel: nada a fazer */ });
