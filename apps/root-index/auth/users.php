<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

liganer_auth_json_headers();
liganer_auth_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $items = [];
    foreach (liganer_auth_users() as $user) {
        $items[] = liganer_auth_public_user($user);
    }
    echo json_encode(['ok' => true, 'users' => $items], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode((string) $raw, true);
if (!is_array($payload)) {
    $payload = $_POST;
}

if ($method === 'POST') {
    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    $name = trim((string) ($payload['name'] ?? ''));
    $password = (string) ($payload['password'] ?? '');

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'E-mail inválido.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($password === '' || strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Senha com pelo menos 6 caracteres.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($name === '') {
        $name = strstr($email, '@', true) ?: $email;
    }

    $users = liganer_auth_users();
    foreach ($users as $user) {
        if (strtolower($user['email']) === $email) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'error' => 'Já existe usuário com este e-mail.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $created = [
        'id' => liganer_auth_make_id($email),
        'email' => $email,
        'name' => $name,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ];
    $users[] = $created;
    if (!liganer_auth_save_users($users)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Não foi possível gravar usuários (permissão data/).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'user' => liganer_auth_public_user($created)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'PUT' || $method === 'PATCH') {
    $id = trim((string) ($payload['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Informe id.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $users = liganer_auth_users();
    $index = -1;
    foreach ($users as $i => $user) {
        if ($user['id'] === $id) {
            $index = $i;
            break;
        }
    }
    if ($index < 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Usuário não encontrado.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $current = $users[$index];
    $isProtectedAdmin = strtolower($current['email']) === LIGANER_AUTH_ADMIN_EMAIL;

    if (array_key_exists('name', $payload)) {
        $name = trim((string) $payload['name']);
        if ($name === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Nome inválido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $current['name'] = $name;
    }

    if (array_key_exists('email', $payload)) {
        $email = strtolower(trim((string) $payload['email']));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'E-mail inválido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if ($isProtectedAdmin && $email !== LIGANER_AUTH_ADMIN_EMAIL) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Não é permitido alterar o e-mail do administrador.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        foreach ($users as $i => $user) {
            if ($i !== $index && strtolower($user['email']) === $email) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'error' => 'Já existe usuário com este e-mail.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        $current['email'] = $email;
    }

    if (array_key_exists('password', $payload)) {
        $password = (string) $payload['password'];
        if ($password !== '') {
            if (strlen($password) < 6) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Senha com pelo menos 6 caracteres.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $current['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }
    }

    $users[$index] = $current;
    if (!liganer_auth_save_users($users)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Não foi possível gravar usuários (permissão data/).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'user' => liganer_auth_public_user($current)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'DELETE') {
    $id = trim((string) ($payload['id'] ?? ($_GET['id'] ?? '')));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Informe id.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $users = liganer_auth_users();
    $found = null;
    $next = [];
    foreach ($users as $user) {
        if ($user['id'] === $id) {
            $found = $user;
            continue;
        }
        $next[] = $user;
    }
    if ($found === null) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Usuário não encontrado.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (strtolower($found['email']) === LIGANER_AUTH_ADMIN_EMAIL) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Não é permitido excluir o administrador.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!liganer_auth_save_users($next)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Não foi possível gravar usuários (permissão data/).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'id' => $id], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Use GET, POST, PUT ou DELETE'], JSON_UNESCAPED_UNICODE);
