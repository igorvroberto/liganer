<?php
/**
 * Sync automático dos leads:
 * 1) grava data/leads.csv na hospedagem (efeito imediato)
 * 2) faz commit de radar-comercial/LEADS.csv no GitHub (fonte da verdade + redeploy FTP)
 *
 * POST JSON: { "leads": [ {...}, ... ], "message"?: "..." }
 * Header: X-Sync-Secret: <mesmo valor de config.local.php / config.json>
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Sync-Secret');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(405, ['ok' => false, 'error' => 'Use POST']);
}

$configPath = __DIR__ . '/config.local.php';
if (!is_file($configPath)) {
    json_out(503, [
        'ok' => false,
        'error' => 'Sync não configurado (falta api/config.local.php). Veja deploy/README.md.',
    ]);
}

/** @var array{sync_secret:string,github_token:string,github_repo:string,github_branch:string,github_csv_path:string} $config */
$config = require $configPath;
$secret = (string) ($config['sync_secret'] ?? '');
$token = (string) ($config['github_token'] ?? '');
$repo = (string) ($config['github_repo'] ?? '');
$branch = (string) ($config['github_branch'] ?? 'main');
$csvPath = (string) ($config['github_csv_path'] ?? 'radar-comercial/LEADS.csv');

if ($secret === '' || $token === '' || $repo === '') {
    json_out(503, ['ok' => false, 'error' => 'config.local.php incompleto']);
}

$provided = $_SERVER['HTTP_X_SYNC_SECRET'] ?? '';
if (!is_string($provided) || !hash_equals($secret, $provided)) {
    json_out(401, ['ok' => false, 'error' => 'Segredo inválido']);
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    json_out(400, ['ok' => false, 'error' => 'Body vazio']);
}

$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['leads']) || !is_array($data['leads'])) {
    json_out(400, ['ok' => false, 'error' => 'JSON inválido: esperado { leads: [] }']);
}

$leads = $data['leads'];
foreach ($leads as $i => $row) {
    if (!is_array($row) || empty($row['id']) || empty($row['empresa'])) {
        json_out(400, ['ok' => false, 'error' => "Lead inválido no índice $i"]);
    }
}

$message = isset($data['message']) && is_string($data['message']) && $data['message'] !== ''
    ? $data['message']
    : ('Atualiza leads via prospecção (' . count($leads) . ' registros)');

$csv = leads_to_csv($leads);
$localFile = dirname(__DIR__) . '/data/leads.csv';
$localDir = dirname($localFile);
if (!is_dir($localDir) && !mkdir($localDir, 0755, true) && !is_dir($localDir)) {
    json_out(500, ['ok' => false, 'error' => 'Não foi possível criar pasta data/']);
}

if (file_put_contents($localFile, $csv) === false) {
    json_out(500, ['ok' => false, 'error' => 'Falha ao gravar data/leads.csv']);
}

$github = github_put_file($token, $repo, $csvPath, $branch, $csv, $message);

if (!$github['ok']) {
    json_out(502, [
        'ok' => false,
        'count' => count($leads),
        'local' => true,
        'github' => false,
        'error' => 'CSV local atualizado, mas falhou o commit no GitHub: ' . ($github['error'] ?? ''),
        'github_error' => $github['error'] ?? null,
    ]);
}

json_out(200, [
    'ok' => true,
    'count' => count($leads),
    'local' => true,
    'github' => true,
    'github_error' => null,
    'commit' => $github['commit'] ?? null,
]);

/**
 * @param list<array<string, mixed>> $leads
 */
function leads_to_csv(array $leads): string
{
    $columns = [
        'id', 'empresa', 'cnpj', 'cidade', 'estado', 'distancia_km_aracatuba',
        'categoria', 'subcategoria', 'produto_provavel', 'produto_secundario',
        'justificativa_produto', 'potencial', 'multiproduto', 'multioportunidade',
        'consumo_estimado', 'compra_recorrente', 'tipo_operacao', 'o_que_fabrica_constroi',
        'obras_atuais', 'fornecedor_atual', 'comprador', 'cargo_comprador',
        'telefone', 'whatsapp', 'email', 'site', 'endereco', 'fonte',
        'data_pesquisa', 'ultimo_contato', 'situacao', 'proxima_acao',
        'necessidade_identificada', 'motivo_prospect',
        'abordagem', 'observacoes_comerciais',
    ];

    $fh = fopen('php://temp', 'r+');
    if ($fh === false) {
        throw new RuntimeException('temp stream');
    }
    fputcsv($fh, $columns);
    foreach ($leads as $row) {
        $line = [];
        foreach ($columns as $col) {
            $val = $row[$col] ?? '';
            if (is_bool($val)) {
                $val = $val ? 'Sim' : 'Não';
            } elseif (!is_scalar($val) && $val !== null) {
                $val = json_encode($val, JSON_UNESCAPED_UNICODE);
            }
            $line[] = (string) $val;
        }
        fputcsv($fh, $line);
    }
    rewind($fh);
    $out = stream_get_contents($fh);
    fclose($fh);
    return $out === false ? '' : $out;
}

/**
 * @return array{ok:bool,error?:string,commit?:string}
 */
function github_put_file(
    string $token,
    string $repo,
    string $path,
    string $branch,
    string $content,
    string $message,
): array {
    $api = 'https://api.github.com/repos/' . $repo . '/contents/'
        . implode('/', array_map('rawurlencode', explode('/', $path)));

    $existing = github_request('GET', $api . '?ref=' . rawurlencode($branch), $token);
    $sha = null;
    if ($existing['status'] === 200 && is_array($existing['json']) && isset($existing['json']['sha'])) {
        $sha = (string) $existing['json']['sha'];
        $current = base64_decode((string) ($existing['json']['content'] ?? ''), true);
        if ($current !== false && $current === $content) {
            return ['ok' => true, 'commit' => 'unchanged'];
        }
    } elseif ($existing['status'] !== 404) {
        return [
            'ok' => false,
            'error' => 'GET GitHub HTTP ' . $existing['status'] . ': ' . ($existing['raw'] ?? ''),
        ];
    }

    $body = [
        'message' => $message,
        'content' => base64_encode($content),
        'branch' => $branch,
    ];
    if ($sha) {
        $body['sha'] = $sha;
    }

    $put = github_request('PUT', $api, $token, $body);
    if ($put['status'] >= 200 && $put['status'] < 300) {
        $commit = null;
        if (is_array($put['json'])) {
            $commit = $put['json']['commit']['sha'] ?? $put['json']['content']['sha'] ?? null;
        }
        return ['ok' => true, 'commit' => is_string($commit) ? $commit : null];
    }

    return [
        'ok' => false,
        'error' => 'PUT GitHub HTTP ' . $put['status'] . ': ' . ($put['raw'] ?? ''),
    ];
}

/**
 * @param array<string, mixed>|null $body
 * @return array{status:int,json:mixed,raw:string}
 */
function github_request(string $method, string $url, string $token, ?array $body = null): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        return ['status' => 0, 'json' => null, 'raw' => 'curl_init failed'];
    }
    $headers = [
        'Accept: application/vnd.github+json',
        'Authorization: Bearer ' . $token,
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: liganer-prospeccao-sync',
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 45,
    ];
    if ($body !== null) {
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_HTTPHEADER] = $headers;
        $opts[CURLOPT_POSTFIELDS] = $payload;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return ['status' => 0, 'json' => null, 'raw' => $err];
    }
    curl_close($ch);
    $json = json_decode($raw, true);
    return ['status' => $status, 'json' => $json, 'raw' => $raw];
}

/**
 * @param array<string, mixed> $payload
 */
function json_out(int $code, array $payload): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
