<?php
/**
 * API de orçamentos salvos — blanks/slitters.
 * Auth: header X-Sync-Secret (igual ao sync do chapas).
 *
 * POST   — cria/atualiza (se number existir no payload e o arquivo existir → update)
 * GET    — lista resumos
 * GET ?number=XXXX — orçamento completo
 * DELETE ?number=XXXX — apaga
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Sync-Secret');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$root = dirname(__DIR__);
$configPath = $root . '/config.json';
$dataDir = $root . '/data';

if (!is_file($configPath)) {
    respond(500, ['ok' => false, 'error' => 'config.json ausente no host.']);
}

$configRaw = file_get_contents($configPath);
$config = json_decode($configRaw ?: 'null', true);
if (!is_array($config)) {
    respond(500, ['ok' => false, 'error' => 'config.json inválido.']);
}

$expected = trim((string)($config['syncSecret'] ?? ''));
$provided = trim((string)($_SERVER['HTTP_X_SYNC_SECRET'] ?? ''));
if ($expected === '' || !hash_equals($expected, $provided)) {
    respond(401, ['ok' => false, 'error' => 'Não autorizado.']);
}

if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true) && !is_dir($dataDir)) {
    respond(500, ['ok' => false, 'error' => 'Não foi possível criar a pasta data/.']);
}

function budget_path(string $dataDir, string $number): string
{
    return $dataDir . '/orcamento-' . $number . '.json';
}

function sanitize_number(string $number): ?string
{
    $number = trim($number);
    if ($number === '' || !preg_match('/^\d{8}$/', $number)) {
        return null;
    }
    return $number;
}

function next_server_number(string $dataDir, ?DateTimeImmutable $now = null): string
{
    $now = $now ?? new DateTimeImmutable('now');
    $ymd = $now->format('ymd');
    $max = 0;
    foreach (glob($dataDir . '/orcamento-' . $ymd . '*.json') ?: [] as $file) {
        if (preg_match('/orcamento-(\d{8})\.json$/', basename($file), $m)) {
            $seq = (int)substr($m[1], 6, 2);
            if ($seq > $max) {
                $max = $seq;
            }
        }
    }
    $next = min(99, $max + 1);
    return $ymd . str_pad((string)$next, 2, '0', STR_PAD_LEFT);
}

function read_budget_file(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    $json = json_decode($raw ?: 'null', true);
    return is_array($json) ? $json : null;
}

function list_item_from_budget(array $budget, string $fallbackNumber): array
{
    $number = trim((string)($budget['number'] ?? $fallbackNumber));
    $client = $budget['client'] ?? [];
    $clientName = is_array($client) ? (string)($client['name'] ?? '') : '';
    $cnpj = is_array($client) ? (string)($client['cnpj'] ?? '') : '';
    $owner = is_array($budget['owner'] ?? null) ? $budget['owner'] : null;
    $summary = is_array($budget['summary'] ?? null) ? $budget['summary'] : [];
    $totalKg = isset($summary['totalKg']) && is_numeric($summary['totalKg'])
        ? (float) $summary['totalKg']
        : null;
    $totalRs = isset($summary['total']) && is_numeric($summary['total'])
        ? (float) $summary['total']
        : null;
    $situacaoRaw = strtolower(trim((string) ($budget['situacao'] ?? 'analise')));
    if ($situacaoRaw === 'análise' || $situacaoRaw === 'em analise' || $situacaoRaw === 'em análise') {
        $situacaoRaw = 'analise';
    }
    if ($situacaoRaw !== 'perdido' && $situacaoRaw !== 'ganho' && $situacaoRaw !== 'analise') {
        $situacaoRaw = 'analise';
    }
    return [
        'id' => (string)($budget['id'] ?? $number),
        'number' => $number,
        'name' => $number,
        'client' => $clientName,
        'cnpj' => $cnpj,
        'createdAt' => (string)($budget['createdAt'] ?? ''),
        'savedAt' => (string)($budget['savedAt'] ?? $budget['createdAt'] ?? ''),
        'source' => 'remote',
        'owner' => $owner ? [
            'id' => (string)($owner['id'] ?? $owner['email'] ?? ''),
            'email' => (string)($owner['email'] ?? ''),
            'name' => (string)($owner['name'] ?? $owner['email'] ?? ''),
        ] : null,
        'totalKg' => $totalKg,
        'totalRs' => $totalRs,
        'situacao' => $situacaoRaw,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $numberParam = isset($_GET['number']) ? sanitize_number((string)$_GET['number']) : null;
    if ($numberParam !== null) {
        $path = budget_path($dataDir, $numberParam);
        $budget = read_budget_file($path);
        if ($budget === null) {
            respond(404, ['ok' => false, 'error' => 'Orçamento não encontrado.']);
        }
        $budget['ok'] = true;
        $budget['number'] = $numberParam;
        $budget['name'] = $numberParam;
        $budget['source'] = 'remote';
        respond(200, $budget);
    }

    $items = [];
    foreach (glob($dataDir . '/orcamento-*.json') ?: [] as $file) {
        if (!preg_match('/orcamento-(\d{8})\.json$/', basename($file), $m)) {
            continue;
        }
        $budget = read_budget_file($file);
        if ($budget === null) {
            continue;
        }
        $items[] = list_item_from_budget($budget, $m[1]);
    }
    usort($items, static function (array $a, array $b): int {
        $ta = (string)($a['createdAt'] ?? $a['savedAt'] ?? '');
        $tb = (string)($b['createdAt'] ?? $b['savedAt'] ?? '');
        $cmp = strcmp($tb, $ta);
        if ($cmp !== 0) {
            return $cmp;
        }
        return strnatcasecmp((string)($b['number'] ?? ''), (string)($a['number'] ?? ''));
    });
    respond(200, ['ok' => true, 'items' => $items]);
}

if ($method === 'DELETE') {
    $numberParam = isset($_GET['number']) ? sanitize_number((string)$_GET['number']) : null;
    if ($numberParam === null) {
        respond(400, ['ok' => false, 'error' => 'Informe number.']);
    }
    $path = budget_path($dataDir, $numberParam);
    if (is_file($path) && !unlink($path)) {
        respond(500, ['ok' => false, 'error' => 'Não foi possível excluir.']);
    }
    respond(200, ['ok' => true, 'number' => $numberParam]);
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw ?: 'null', true);
    if (!is_array($payload)) {
        respond(400, ['ok' => false, 'error' => 'JSON inválido.']);
    }

    $requested = sanitize_number((string)($payload['number'] ?? ''));
    $now = (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM);
    $path = null;
    $number = null;

    if ($requested !== null) {
        $path = budget_path($dataDir, $requested);
        if (is_file($path)) {
            $existing = read_budget_file($path) ?? [];
            $number = $requested;
            $payload['id'] = (string)($existing['id'] ?? $payload['id'] ?? $number);
            $payload['createdAt'] = (string)($existing['createdAt'] ?? $payload['createdAt'] ?? $now);
        } else {
            // Número pedido ainda não existe — usa como novo se válido.
            $number = $requested;
            $path = budget_path($dataDir, $number);
            $payload['id'] = (string)($payload['id'] ?? $number);
            $payload['createdAt'] = (string)($payload['createdAt'] ?? $now);
        }
    } else {
        $number = next_server_number($dataDir);
        $path = budget_path($dataDir, $number);
        $payload['id'] = (string)($payload['id'] ?? $number);
        $payload['createdAt'] = (string)($payload['createdAt'] ?? $now);
    }

    $payload['number'] = $number;
    $payload['name'] = $number;
    // Honra savedAt do cliente: edição manda "agora"; só situação mantém o horário anterior.
    $clientSavedAt = trim((string) ($payload['savedAt'] ?? ''));
    $payload['savedAt'] = $clientSavedAt !== '' ? $clientSavedAt : $now;
    $payload['source'] = 'remote';

    if (isset($existing) && is_array($existing) && !empty($existing['situacao']) && empty($payload['situacao'])) {
        $payload['situacao'] = $existing['situacao'];
    }
    $situacaoRaw = strtolower(trim((string) ($payload['situacao'] ?? 'analise')));
    if ($situacaoRaw === 'análise' || $situacaoRaw === 'em analise' || $situacaoRaw === 'em análise') {
        $situacaoRaw = 'analise';
    }
    if ($situacaoRaw !== 'perdido' && $situacaoRaw !== 'ganho' && $situacaoRaw !== 'analise') {
        $situacaoRaw = 'analise';
    }
    $payload['situacao'] = $situacaoRaw;

    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encoded === false || file_put_contents($path, $encoded . "\n", LOCK_EX) === false) {
        respond(500, ['ok' => false, 'error' => 'Falha ao gravar orçamento.']);
    }

    respond(200, ['ok' => true, 'number' => $number, 'name' => $number]);
}

respond(405, ['ok' => false, 'error' => 'Método não permitido.']);
