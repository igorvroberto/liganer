<?php
/**
 * Copie para config.local.php na hospedagem (ou deixe o Action gerar no deploy).
 * NÃO versione config.local.php com tokens reais.
 */
return [
    'sync_secret' => 'troque-por-um-segredo-longo',
    'github_token' => 'ghp_ou_fine_grained_token_com_contents_write',
    'github_repo' => 'igorvroberto/liganer-prospeccao',
    'github_branch' => 'main',
    'github_csv_path' => 'radar-comercial/LEADS.csv',
];
