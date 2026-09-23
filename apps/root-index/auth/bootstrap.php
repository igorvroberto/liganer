<?php
/**
 * Sessão compartilhada de vendas.liganer.com.br
 * Cookie path=/ — válido em /orcamento/*, /prospeccao/, etc.
 *
 * Usuários: data/users.json na raiz do domínio (criado no 1º save).
 * Admin: apenas igor.roberto@liganer.com.br gerencia usuários.
 */
declare(strict_types=1);

const LIGANER_AUTH_SESSION = 'LIGANER_VENDAS_SESS';
const LIGANER_AUTH_ADMIN_EMAIL = 'igor.roberto@liganer.com.br';

function liganer_auth_bootstrap(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    session_name(LIGANER_AUTH_SESSION);
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 14,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function liganer_auth_json_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
}

/**
 * @return array{id:string,email:string,name:string}|null
 */
function liganer_auth_user(): ?array
{
    liganer_auth_bootstrap();
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || empty($user['email'])) {
        return null;
    }
    return [
        'id' => (string) ($user['id'] ?? $user['email']),
        'email' => (string) $user['email'],
        'name' => (string) ($user['name'] ?? $user['email']),
    ];
}

function liganer_auth_is_admin(?array $user = null): bool
{
    $current = $user ?? liganer_auth_user();
    if ($current === null) {
        return false;
    }
    return strtolower((string) $current['email']) === LIGANER_AUTH_ADMIN_EMAIL;
}

function liganer_auth_require_admin(): array
{
    $user = liganer_auth_user();
    if ($user === null) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Faça login.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!liganer_auth_is_admin($user)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Sem permissão.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $user;
}

function liganer_auth_users_path(): string
{
    return dirname(__DIR__) . '/data/users.json';
}

/**
 * @return list<array{id:string,email:string,name:string,password_hash:string}>
 */
function liganer_auth_default_users(): array
{
    return [
        [
            'id' => 'igor.roberto',
            'email' => 'igor.roberto@liganer.com.br',
            'name' => 'Igor Roberto',
            'password_hash' => '$2y$10$9XZFUpTeKKQOTj1YUsH5o.D/yyAPy1VLr1B/tnd1qrC7W5UMRzAX6',
        ],
        [
            'id' => 'phelipe.hernandez',
            'email' => 'phelipe.hernandez@liganer.com.br',
            'name' => 'Phelipe Hernandez',
            'password_hash' => '$2y$10$HEDlYs7duOBbuJ26H/OrceWXgtNlryzKU7rjoKpDVILf6GcdCUu0G',
        ],
    ];
}

/**
 * @param mixed $raw
 * @return list<array{id:string,email:string,name:string,password_hash:string}>
 */
function liganer_auth_normalize_users($raw): array
{
    if (!is_array($raw)) {
        return [];
    }
    $list = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        $email = strtolower(trim((string) ($item['email'] ?? '')));
        $hash = (string) ($item['password_hash'] ?? '');
        if ($email === '' || $hash === '') {
            continue;
        }
        $id = trim((string) ($item['id'] ?? ''));
        if ($id === '') {
            $id = preg_replace('/[^a-z0-9._-]+/', '-', strstr($email, '@', true) ?: $email) ?: $email;
        }
        $list[] = [
            'id' => $id,
            'email' => $email,
            'name' => trim((string) ($item['name'] ?? $email)) ?: $email,
            'password_hash' => $hash,
        ];
    }
    return $list;
}

/**
 * @return list<array{id:string,email:string,name:string,password_hash:string}>
 */
function liganer_auth_users(): array
{
    $path = liganer_auth_users_path();
    if (is_readable($path)) {
        $decoded = json_decode((string) file_get_contents($path), true);
        $users = liganer_auth_normalize_users(is_array($decoded) ? ($decoded['users'] ?? $decoded) : null);
        if ($users) {
            return $users;
        }
    }
    $defaults = liganer_auth_default_users();
    liganer_auth_save_users($defaults);
    return $defaults;
}

/**
 * @param list<array{id:string,email:string,name:string,password_hash:string}> $users
 */
function liganer_auth_save_users(array $users): bool
{
    $path = liganer_auth_users_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        return false;
    }
    $payload = [
        'updatedAt' => date('c'),
        'users' => array_values($users),
    ];
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }
    return file_put_contents($path, $json . "\n", LOCK_EX) !== false;
}

function liganer_auth_public_user(array $user): array
{
    return [
        'id' => (string) $user['id'],
        'email' => (string) $user['email'],
        'name' => (string) $user['name'],
    ];
}

function liganer_auth_make_id(string $email): string
{
    $local = strstr(strtolower($email), '@', true);
    $base = preg_replace('/[^a-z0-9._-]+/', '-', $local ?: $email) ?: 'user';
    $base = trim($base, '-');
    if ($base === '') {
        $base = 'user';
    }
    $ids = [];
    foreach (liganer_auth_users() as $user) {
        $ids[strtolower($user['id'])] = true;
    }
    if (!isset($ids[strtolower($base)])) {
        return $base;
    }
    $i = 2;
    while (isset($ids[strtolower($base . '-' . $i)])) {
        $i += 1;
    }
    return $base . '-' . $i;
}
